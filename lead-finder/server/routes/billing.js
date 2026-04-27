const express = require('express');
const db = require('../db');

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

router.post('/checkout', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not signed in' });

  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: 'Billing is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in' });

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: String(user.id) } });
    customerId = customer.id;
    db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.APP_URL}/app?checkout=success`,
    cancel_url: `${process.env.APP_URL}/app?checkout=cancel`,
    allow_promotion_codes: true,
  });

  res.json({ url: session.url });
});

router.post('/portal', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not signed in' });
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Billing is not configured.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user?.stripe_customer_id) return res.status(400).json({ error: 'No Stripe customer for this user' });

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${process.env.APP_URL}/app`,
  });
  res.json({ url: portal.url });
});

// Stripe webhook — must be mounted with raw body parser in index.js
async function webhookHandler(req, res) {
  const stripe = getStripe();
  if (!stripe) return res.status(503).send('billing-not-configured');

  let event;
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString('utf8'));
    }
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const updateFromSub = (sub) => {
    const customerId = sub.customer;
    const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(customerId);
    if (!user) return;
    db.prepare(
      `UPDATE users SET stripe_subscription_id = ?, subscription_status = ?, current_period_end = ? WHERE id = ?`
    ).run(sub.id, sub.status, sub.current_period_end || null, user.id);
  };

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      updateFromSub(event.data.object);
      break;
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        updateFromSub(sub);
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
}

module.exports = { router, webhookHandler };
