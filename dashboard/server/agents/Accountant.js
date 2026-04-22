import { BaseAgent } from './BaseAgent.js';
import { getDb, getSetting } from '../database.js';

// Approximate cost per 1K tokens by model.
// `input`/`output` for standard tokens; `cacheWrite`/`cacheRead` for prompt-cache.
const COST_PER_1K = {
  'claude-sonnet-4-6': { input: 0.003, output: 0.015, cacheWrite: 0.00375, cacheRead: 0.0003 },
  'claude-haiku-4-5':  { input: 0.001, output: 0.005, cacheWrite: 0.00125, cacheRead: 0.0001 },
  'gpt-4o':            { input: 0.005, output: 0.015, cacheWrite: 0.005,   cacheRead: 0.0025 },
  'gpt-4o-mini':       { input: 0.00015, output: 0.0006, cacheWrite: 0.00015, cacheRead: 0.000075 },
  default:             { input: 0.003, output: 0.015, cacheWrite: 0.00375, cacheRead: 0.0003 },
};

// Cost a token-usage record. `usage` is either a scalar (legacy approximate
// count) or a Claude `response.usage` object with input/output/cache fields.
function costTokens(usage, model) {
  const p = COST_PER_1K[model] || COST_PER_1K.default;
  if (typeof usage === 'number') {
    // Legacy path: treat as output-equivalent tokens.
    return { tokens: usage, cost: (usage / 1000) * p.output };
  }
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cost =
    (input / 1000) * p.input +
    (output / 1000) * p.output +
    (cacheWrite / 1000) * p.cacheWrite +
    (cacheRead / 1000) * p.cacheRead;
  return { tokens: input + output + cacheWrite + cacheRead, cost };
}

export class Accountant extends BaseAgent {
  constructor(broadcast) {
    super('Accountant', broadcast);
    this.alertThreshold = 0.8; // warn at 80% budget
    this.hasWarned = false;
  }

  async start() {
    await super.start();
    this.monitorInterval = setInterval(() => this.checkBudget(), 30000);
  }

  async stop() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    await super.stop();
  }

  // `usage` can be a scalar token count (legacy) or a Claude `response.usage`
  // object. Skip zero-token records so Scout/Scraper/Postman don't spam the
  // log when they don't call an LLM.
  trackUsage(agentName, usage, model = 'default') {
    if (!usage || (typeof usage === 'number' && usage === 0)) return;
    const { tokens, cost } = costTokens(usage, model);
    if (tokens === 0) return;

    const db = getDb();
    db.prepare(
      'INSERT INTO token_usage (agent_name, tokens_used, cost_estimate, model) VALUES (?, ?, ?, ?)'
    ).run(agentName, tokens, cost, model);

    this.broadcast('token_usage', {
      agent: agentName,
      tokens,
      cost,
      model,
      timestamp: new Date().toISOString(),
    });

    this.heartbeat();
  }

  checkBudget() {
    const db = getDb();
    const dailyLimit = parseInt(getSetting('daily_token_limit')) || 5000000;

    const today = db.prepare(
      "SELECT COALESCE(SUM(tokens_used), 0) as total, COALESCE(SUM(cost_estimate), 0) as cost FROM token_usage WHERE date(created_at) = date('now')"
    ).get();

    const usage = today.total / dailyLimit;

    if (usage >= this.alertThreshold && !this.hasWarned) {
      this.log(`Token budget at ${Math.round(usage * 100)}% — approaching limit`, 'warning');
      this.logIssue(
        `Token usage at ${Math.round(usage * 100)}% of daily limit`,
        'warning',
        'Consider reducing pipeline throughput or increasing budget'
      );
      this.hasWarned = true;
    }

    if (usage >= 1.0) {
      this.log('Token budget EXCEEDED — throttling agents', 'error');
      this.broadcast('budget_exceeded', { usage: today.total, limit: dailyLimit });
    }

    // Reset warning flag at midnight (approximate)
    const hour = new Date().getHours();
    if (hour === 0) this.hasWarned = false;

    return {
      tokensUsed: today.total,
      costEstimate: today.cost,
      dailyLimit,
      usagePercent: Math.round(usage * 100),
    };
  }

  getReport() {
    const db = getDb();

    const byAgent = db.prepare(
      "SELECT agent_name, SUM(tokens_used) as tokens, SUM(cost_estimate) as cost FROM token_usage WHERE date(created_at) = date('now') GROUP BY agent_name ORDER BY tokens DESC"
    ).all();

    const sitesBuilt = db.prepare("SELECT COUNT(*) as c FROM sites WHERE status = 'completed'").get().c;
    const emailsSent = db.prepare("SELECT COUNT(*) as c FROM emails WHERE status = 'sent'").get().c;

    const totalCost = byAgent.reduce((sum, a) => sum + a.cost, 0);

    return {
      byAgent,
      totalCost,
      costPerSite: sitesBuilt > 0 ? totalCost / sitesBuilt : 0,
      costPerEmail: emailsSent > 0 ? totalCost / emailsSent : 0,
      mostExpensive: byAgent[0] || null,
    };
  }
}
