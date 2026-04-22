import { Router } from 'express';
import { getDb, getSetting, setSetting } from '../database.js';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// GET /api/settings — list all settings; mask any key ending in `_api_key` or `_token`.
router.get('/', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    const isSecret = /_api_key$|_token$/.test(row.key);
    if (isSecret && row.value) {
      settings[row.key] = '••••' + row.value.slice(-4);
    } else {
      settings[row.key] = row.value;
    }
  }
  res.json(settings);
});

// PUT /api/settings — update any keys. Values starting with •••• are skipped
// (the UI shows a mask and we don't want to overwrite real keys with the mask).
router.put('/', (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'string' && value.startsWith('••••')) continue;
    setSetting(key, value);
  }
  res.json({ success: true });
});

// GET /api/settings/validate — quick "key is present" check. Used for the
// status pills on the Settings page without making any outbound calls.
router.get('/validate', (_req, res) => {
  const checks = {
    google_maps_api_key: !!getSetting('google_maps_api_key'),
    llm_api_key: !!(getSetting('anthropic_api_key') || getSetting('openai_api_key')),
    email_api_key: !!getSetting('sendgrid_api_key'),
    email_from: !!getSetting('sendgrid_from_email'),
  };
  const allValid = Object.values(checks).every(Boolean);
  res.json({ checks, allValid });
});

// POST /api/settings/preflight — runs all provider probes in parallel. One
// pass/fail per provider plus an overall boolean. Use this before starting a
// real-keys run so you don't burn time before discovering a 401.
router.post('/preflight', async (_req, res) => {
  const providers = ['google_maps', 'anthropic', 'sendgrid'];
  const results = await Promise.all(
    providers.map(async (p) => {
      try {
        const r = await _runProbe(p);
        return { provider: p, ...r };
      } catch (err) {
        return { provider: p, ok: false, detail: err.message || String(err) };
      }
    }),
  );
  const allOk = results.every((r) => r.ok);
  res.json({ allOk, results });
});

// POST /api/settings/test-key — actually hits the provider with a tiny
// no-op request to confirm the key works. Returns { ok, detail }.
async function _runProbe(provider) {
  if (provider === 'google_maps') {
    const key = getSetting('google_maps_api_key');
    if (!key) return { ok: false, detail: 'No key set.' };
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id',
      },
      body: JSON.stringify({ textQuery: 'coffee in 90210', pageSize: 1 }),
    });
    if (r.ok) return { ok: true, detail: 'Places API responded 200.' };
    return { ok: false, detail: `${r.status}: ${(await r.text()).slice(0, 200)}` };
  }
  if (provider === 'anthropic') {
    const key = getSetting('anthropic_api_key');
    if (!key) return { ok: false, detail: 'No key set.' };
    const client = new Anthropic({ apiKey: key });
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with only: ok' }],
    });
    const txt = resp.content.find((b) => b.type === 'text')?.text || '';
    return { ok: true, detail: `Claude Haiku replied: "${txt.trim().slice(0, 40)}"` };
  }
  if (provider === 'sendgrid') {
    const key = getSetting('sendgrid_api_key');
    if (!key) return { ok: false, detail: 'No key set.' };
    const r = await fetch('https://api.sendgrid.com/v3/scopes', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (r.ok) return { ok: true, detail: 'SendGrid API responded 200.' };
    return { ok: false, detail: `${r.status}: ${(await r.text()).slice(0, 200)}` };
  }
  return { ok: false, detail: `Unknown provider: ${provider}` };
}

router.post('/test-key', async (req, res) => {
  const { provider } = req.body;

  try {
    if (provider === 'google_maps') {
      const key = getSetting('google_maps_api_key');
      if (!key) return res.json({ ok: false, detail: 'No key set.' });
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.id',
        },
        body: JSON.stringify({ textQuery: 'coffee in 90210', pageSize: 1 }),
      });
      if (r.ok) return res.json({ ok: true, detail: 'Places API responded 200.' });
      const text = await r.text();
      return res.json({ ok: false, detail: `${r.status}: ${text.slice(0, 200)}` });
    }

    if (provider === 'anthropic') {
      const key = getSetting('anthropic_api_key');
      if (!key) return res.json({ ok: false, detail: 'No key set.' });
      const client = new Anthropic({ apiKey: key });
      const resp = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with only: ok' }],
      });
      const txt = resp.content.find((b) => b.type === 'text')?.text || '';
      return res.json({
        ok: true,
        detail: `Claude Haiku replied: "${txt.trim().slice(0, 40)}"`,
      });
    }

    if (provider === 'sendgrid') {
      const key = getSetting('sendgrid_api_key');
      if (!key) return res.json({ ok: false, detail: 'No key set.' });
      // /v3/scopes is a lightweight auth-only probe.
      const r = await fetch('https://api.sendgrid.com/v3/scopes', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (r.ok) return res.json({ ok: true, detail: 'SendGrid API responded 200.' });
      const text = await r.text();
      return res.json({ ok: false, detail: `${r.status}: ${text.slice(0, 200)}` });
    }

    res.json({ ok: false, detail: `Unknown provider: ${provider}` });
  } catch (err) {
    res.json({ ok: false, detail: err.message || String(err) });
  }
});

export default router;
