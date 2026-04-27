require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const { router: authRouter } = require('./routes/auth');
const { router: billingRouter, webhookHandler } = require('./routes/billing');
const leadsRouter = require('./routes/leads');

const app = express();

// Stripe webhook needs the raw body — mount BEFORE express.json().
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json({ limit: '1mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

app.use('/api/auth', authRouter);
app.use('/api/billing', billingRouter);
app.use('/api', leadsRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/app', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'app.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lead Finder running on http://localhost:${PORT}`);
  if (process.env.DEV_BYPASS_BILLING === 'true') {
    console.log('  ⚠ DEV_BYPASS_BILLING=true — every signed-in user is treated as subscribed.');
  }
});
