// Central cost + usage accounting. Every external call logs here so the
// dashboard and the Overseer can enforce budget caps.
//
// Prices are per 1M tokens (USD). Keep in sync with provider pricing pages.

import { getDb, getSetting } from '../database.js';
import { broadcast } from './websocket.js';

// Anthropic pricing (per 1M tokens input / output). Base rates only — cached
// reads cost 0.1× input rate, cache writes 1.25× for 5-min TTL.
const CLAUDE_PRICES = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-7': { input: 5.0, output: 25.0 },
};

// Google Maps pricing (per-request). Places API (New) rates.
// Text Search Essentials SKU: $0.032/request (beyond free tier).
// Place Details Essentials: $0.017/request.
// Places Photos: $0.007/photo.
const GMAPS_PRICES = {
  'text_search': 0.032,
  'place_details': 0.017,
  'place_photo': 0.007,
};

// SendGrid free tier: 100/day. After that $0.00085 per email on the Pro plan.
// Call it effectively-free for our scale.
const EMAIL_PRICES = {
  'sendgrid_send': 0.00085,
};

export function logClaudeUsage({ agent, model, usage }) {
  const price = CLAUDE_PRICES[model];
  if (!price || !usage) return 0;
  const inputCost =
    ((usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25) * price.input / 1_000_000;
  const cachedInputCost =
    (usage.cache_read_input_tokens || 0) * price.input * 0.1 / 1_000_000;
  const outputCost = (usage.output_tokens || 0) * price.output / 1_000_000;
  const totalCents = Math.round((inputCost + cachedInputCost + outputCost) * 100);
  const totalTokens =
    (usage.input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.output_tokens || 0);

  _record({ agent, model, tokens: totalTokens, cents: totalCents, kind: 'llm' });
  return totalCents;
}

export function logGoogleMapsUsage({ agent, sku, count = 1 }) {
  const unit = GMAPS_PRICES[sku] || 0;
  const cents = Math.round(unit * count * 100);
  _record({ agent, model: `gmaps:${sku}`, tokens: 0, cents, kind: 'gmaps' });
  return cents;
}

export function logEmailUsage({ agent, count = 1 }) {
  const cents = Math.round(EMAIL_PRICES.sendgrid_send * count * 100);
  _record({ agent, model: 'sendgrid', tokens: 0, cents, kind: 'email' });
  return cents;
}

function _record({ agent, model, tokens, cents, kind }) {
  const db = getDb();
  db.prepare(
    'INSERT INTO token_usage (agent_name, tokens_used, cost_estimate, model) VALUES (?, ?, ?, ?)',
  ).run(agent, tokens, cents / 100, model);

  // Emit a real-time event the dashboard can render immediately.
  broadcast('cost_tick', {
    agent,
    model,
    tokens,
    cents,
    kind,
    today_cents: getTodaySpendCents(),
    daily_cap_cents: getDailyCapCents(),
  });
}

export function getTodaySpendCents() {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT ROUND(SUM(cost_estimate) * 100) AS cents FROM token_usage WHERE created_at >= date('now', 'start of day')",
    )
    .get();
  return Math.round(row?.cents || 0);
}

export function getDailyCapCents() {
  const raw = getSetting('daily_budget_usd');
  const dollars = raw == null || raw === '' ? 5 : Number(raw);
  return Math.round(dollars * 100);
}

export function isOverBudget() {
  const cap = getDailyCapCents();
  if (!cap) return false; // 0 = no cap
  return getTodaySpendCents() >= cap;
}

export function breakdownToday() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT agent_name, ROUND(SUM(cost_estimate) * 100) AS cents, SUM(tokens_used) AS tokens, COUNT(*) AS calls
         FROM token_usage
        WHERE created_at >= date('now', 'start of day')
        GROUP BY agent_name`,
    )
    .all();
  return rows.map((r) => ({
    agent: r.agent_name,
    cents: r.cents || 0,
    tokens: r.tokens || 0,
    calls: r.calls || 0,
  }));
}
