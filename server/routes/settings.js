import { Router } from 'express';
import { getDb, getSetting, setSetting } from '../database.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    // Mask API keys for security
    if (row.key.includes('api_key') && row.value) {
      settings[row.key] = row.value ? '••••' + row.value.slice(-4) : '';
    } else {
      settings[row.key] = row.value;
    }
  }
  res.json(settings);
});

router.put('/', (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    // Don't overwrite keys with masked values
    if (typeof value === 'string' && value.startsWith('••••')) continue;
    setSetting(key, value);
  }
  res.json({ success: true });
});

router.get('/validate', (req, res) => {
  const checks = {
    google_maps_api_key: !!getSetting('google_maps_api_key'),
    llm_api_key: !!(getSetting('anthropic_api_key') || getSetting('openai_api_key')),
    email_api_key: !!getSetting('sendgrid_api_key'),
    email_from: !!getSetting('sendgrid_from_email'),
  };
  const allValid = Object.values(checks).every(Boolean);
  res.json({ checks, allValid });
});

export default router;
