const express = require('express');
const db = require('../db');
const { findLeads } = require('../services/leadFinder');
const { generatePitch } = require('../services/pitch');
const { requireAuth, requireSubscription } = require('./auth');

const router = express.Router();

const ALLOWED_TYPES = [
  'plumbers', 'electricians', 'landscapers', 'hair salons', 'barber shops',
  'roofers', 'handymen', 'painters', 'mobile mechanics', 'auto detailers',
  'tutors', 'pet groomers', 'house cleaners', 'movers', 'tree services',
  'pool services', 'hvac', 'locksmiths', 'caterers', 'photographers',
];

router.get('/business-types', (_req, res) => {
  res.json({ types: ALLOWED_TYPES });
});

router.post('/search', requireAuth, requireSubscription, async (req, res) => {
  const { zip, businessType } = req.body || {};
  if (!zip || !/^\d{5}(-\d{4})?$/.test(String(zip).trim())) {
    return res.status(400).json({ error: 'Invalid ZIP code' });
  }
  if (!businessType || typeof businessType !== 'string' || businessType.length > 60) {
    return res.status(400).json({ error: 'Invalid business type' });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return res.status(503).json({ error: 'Server is missing GOOGLE_PLACES_API_KEY' });
  }

  try {
    const { totalFound, leads } = await findLeads({
      zip: String(zip).trim(),
      businessType: businessType.trim(),
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
    });

    const insertSearch = db.prepare(
      'INSERT INTO searches (user_id, zip, business_type, result_count) VALUES (?, ?, ?, ?)'
    );
    const searchId = insertSearch.run(req.session.userId, zip, businessType, leads.length).lastInsertRowid;

    const insertLead = db.prepare(`
      INSERT INTO leads (search_id, place_id, name, address, phone, email, rating, review_count, category, social_link, google_maps_uri)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((rows) => {
      for (const l of rows) {
        insertLead.run(
          searchId, l.place_id, l.name, l.address, l.phone, l.email,
          l.rating, l.review_count, l.category, l.social_link, l.google_maps_uri
        );
      }
    });
    insertMany(leads);

    const stored = db.prepare('SELECT * FROM leads WHERE search_id = ? ORDER BY id').all(searchId);
    res.json({ searchId, totalFound, leads: stored });
  } catch (err) {
    console.error('search error:', err);
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

router.get('/searches', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, zip, business_type, result_count, created_at FROM searches WHERE user_id = ? ORDER BY id DESC LIMIT 50')
    .all(req.session.userId);
  res.json({ searches: rows });
});

router.get('/searches/:id', requireAuth, (req, res) => {
  const search = db
    .prepare('SELECT * FROM searches WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!search) return res.status(404).json({ error: 'Not found' });
  const leads = db.prepare('SELECT * FROM leads WHERE search_id = ? ORDER BY id').all(search.id);
  res.json({ search, leads });
});

router.get('/searches/:id/csv', requireAuth, (req, res) => {
  const search = db
    .prepare('SELECT * FROM searches WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!search) return res.status(404).send('Not found');
  const leads = db.prepare('SELECT * FROM leads WHERE search_id = ? ORDER BY id').all(search.id);

  const headers = ['name', 'address', 'phone', 'email', 'rating', 'review_count', 'category', 'social_link', 'google_maps_uri'];
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const l of leads) lines.push(headers.map((h) => escape(l[h])).join(','));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${search.id}.csv"`);
  res.send(lines.join('\n'));
});

router.post('/leads/:id/pitch', requireAuth, requireSubscription, async (req, res) => {
  const lead = db
    .prepare(`
      SELECT l.* FROM leads l
      JOIN searches s ON s.id = l.search_id
      WHERE l.id = ? AND s.user_id = ?
    `)
    .get(req.params.id, req.session.userId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const sender = req.body?.sender || {};
  const pitch = await generatePitch(lead, sender);
  res.json({ pitch });
});

module.exports = router;
