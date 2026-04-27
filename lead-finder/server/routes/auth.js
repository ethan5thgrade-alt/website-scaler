const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const result = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email.toLowerCase(), hash);

  req.session.userId = result.lastInsertRowid;
  res.json({ ok: true, userId: result.lastInsertRowid });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || !password) return res.status(400).json({ error: 'Invalid input' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  req.session.userId = user.id;
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db
    .prepare('SELECT id, email, subscription_status, current_period_end FROM users WHERE id = ?')
    .get(req.session.userId);
  if (!user) return res.json({ user: null });

  const bypass = process.env.DEV_BYPASS_BILLING === 'true';
  const active =
    bypass ||
    (user.subscription_status === 'active' || user.subscription_status === 'trialing');

  res.json({ user: { ...user, subscription_active: active } });
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not signed in' });
  next();
}

function requireSubscription(req, res, next) {
  if (process.env.DEV_BYPASS_BILLING === 'true') return next();
  const user = db
    .prepare('SELECT subscription_status FROM users WHERE id = ?')
    .get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  if (user.subscription_status !== 'active' && user.subscription_status !== 'trialing') {
    return res.status(402).json({ error: 'Subscription required', code: 'NO_SUBSCRIPTION' });
  }
  next();
}

module.exports = { router, requireAuth, requireSubscription };
