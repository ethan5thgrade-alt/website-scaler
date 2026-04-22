import { Router } from 'express';
import { getDb } from '../database.js';
import { buildDemoForBusiness } from '../services/builderDispatch.js';

const router = Router();

// Dashboard stats
router.get('/stats', (req, res) => {
  const db = getDb();
  const sitesBuilt = db.prepare('SELECT COUNT(*) as count FROM sites WHERE status = ?').get('completed');
  const emailsSent = db.prepare('SELECT COUNT(*) as count FROM emails WHERE status = ?').get('sent');
  const emailsDelivered = db.prepare('SELECT COUNT(*) as count FROM emails WHERE status IN (?, ?, ?)').get('sent', 'opened', 'clicked');
  const emailsOpened = db.prepare('SELECT COUNT(*) as count FROM emails WHERE opened_at IS NOT NULL').get();
  const emailsReplied = db.prepare('SELECT COUNT(*) as count FROM emails WHERE replied_at IS NOT NULL').get();
  const salesTotal = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as revenue FROM sales').get();
  const activePipelines = db.prepare('SELECT COUNT(*) as count FROM pipeline_runs WHERE status = ?').get('running');
  const todayTokens = db.prepare(
    "SELECT COALESCE(SUM(tokens_used), 0) as total FROM token_usage WHERE date(created_at) = date('now')"
  ).get();
  const buildsPerDay = db.prepare(
    "SELECT date(created_at) as day, COUNT(*) as count FROM sites WHERE status = 'completed' GROUP BY date(created_at) ORDER BY day DESC LIMIT 7"
  ).all();

  res.json({
    sitesBuilt: sitesBuilt.count,
    emailsSent: emailsSent.count,
    emailsDelivered: emailsDelivered.count,
    emailsOpened: emailsOpened.count,
    emailsReplied: emailsReplied.count,
    salesCount: salesTotal.count,
    revenue: salesTotal.revenue,
    activePipelines: activePipelines.count,
    tokensToday: todayTokens.total,
    buildsPerDay,
  });
});

// Activity feed
router.get('/activity', (req, res) => {
  const db = getDb();
  const limit = parseInt(req.query.limit) || 50;
  const logs = db.prepare(
    'SELECT * FROM agent_logs ORDER BY created_at DESC LIMIT ?'
  ).all(limit);
  res.json(logs);
});

// Issues
router.get('/issues', (req, res) => {
  const db = getDb();
  const active = db.prepare('SELECT * FROM issues WHERE resolved = 0 ORDER BY created_at DESC').all();
  const resolved = db.prepare('SELECT * FROM issues WHERE resolved = 1 ORDER BY resolved_at DESC LIMIT 20').all();
  res.json({ active, resolved });
});

router.post('/issues/:id/retry', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE issues SET resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Sales
router.get('/sales', (req, res) => {
  const db = getDb();
  const sales = db.prepare('SELECT * FROM sales ORDER BY claimed_at DESC').all();
  const total = db.prepare('SELECT COALESCE(SUM(amount), 0) as revenue FROM sales').get();
  res.json({ sales, totalRevenue: total.revenue });
});

// Simulate a sale (for testing)
router.post('/sales/simulate', (req, res) => {
  const db = getDb();
  const names = ['Mama Rosa Bakery', 'Joe\'s Auto Shop', 'Sunny Nails Salon', 'Peak Fitness Gym', 'Golden Wok', 'Dr. Smith Dental'];
  const locations = ['Beverly Hills, CA', 'Santa Monica, CA', 'Pasadena, CA', 'Malibu, CA'];
  const builders = ['Builder-Alpha', 'Builder-Beta', 'Builder-Gamma'];

  const biz = db.prepare(
    'INSERT INTO businesses (name, address, zip_code, category, status, place_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    names[Math.floor(Math.random() * names.length)],
    locations[Math.floor(Math.random() * locations.length)],
    '90210',
    'restaurant',
    'completed',
    'sim_' + Date.now()
  );

  const site = db.prepare(
    'INSERT INTO sites (business_id, builder_agent, status, build_time_ms) VALUES (?, ?, ?, ?)'
  ).run(biz.lastInsertRowid, builders[Math.floor(Math.random() * builders.length)], 'completed', Math.floor(Math.random() * 5000) + 1000);

  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(biz.lastInsertRowid);

  db.prepare(
    'INSERT INTO sales (business_id, site_id, amount, business_name, location, builder_agent) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(biz.lastInsertRowid, site.lastInsertRowid, 50, business.name, business.address, builders[Math.floor(Math.random() * builders.length)]);

  res.json({ success: true });
});

// Agent statuses
router.get('/agents', (req, res) => {
  const db = getDb();
  const agents = db.prepare('SELECT * FROM agent_status ORDER BY agent_name').all();
  res.json(agents);
});

// Token usage
router.get('/tokens', (req, res) => {
  const db = getDb();
  const today = db.prepare(
    "SELECT agent_name, SUM(tokens_used) as total, SUM(cost_estimate) as cost FROM token_usage WHERE date(created_at) = date('now') GROUP BY agent_name"
  ).all();
  const total = db.prepare(
    "SELECT COALESCE(SUM(tokens_used), 0) as total, COALESCE(SUM(cost_estimate), 0) as cost FROM token_usage WHERE date(created_at) = date('now')"
  ).get();
  const hourly = db.prepare(
    "SELECT strftime('%H', created_at) as hour, SUM(tokens_used) as total FROM token_usage WHERE date(created_at) = date('now') GROUP BY hour ORDER BY hour"
  ).all();
  res.json({ byAgent: today, total, hourly });
});

// Uptime / security
router.get('/uptime', (req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM uptime_logs ORDER BY created_at DESC LIMIT 100').all();
  const restarts = db.prepare(
    "SELECT * FROM uptime_logs WHERE event_type = 'restart' ORDER BY created_at DESC LIMIT 20"
  ).all();
  const agents = db.prepare('SELECT agent_name, status, last_heartbeat, restart_count FROM agent_status').all();
  res.json({ logs, restarts, agents });
});

// Pipeline management
router.get('/pipelines', (req, res) => {
  const db = getDb();
  const pipelines = db.prepare('SELECT * FROM pipeline_runs ORDER BY created_at DESC LIMIT 20').all();
  res.json(pipelines);
});

// Businesses
router.get('/businesses', (req, res) => {
  const db = getDb();
  const limit = parseInt(req.query.limit) || 50;
  const businesses = db.prepare('SELECT * FROM businesses ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json(businesses);
});

// Pricing
router.get('/pricing', (req, res) => {
  const db = getDb();

  const currentPrice = db.prepare("SELECT value FROM settings WHERE key = 'current_price'").get();
  const avgCost = db.prepare("SELECT value FROM settings WHERE key = 'avg_cost_per_business'").get();
  const sampleSize = db.prepare("SELECT value FROM settings WHERE key = 'price_sample_size'").get();

  // Per-step breakdown
  const byStep = db.prepare(`
    SELECT step,
      COUNT(*) as count,
      AVG(total_cost) as avg_cost,
      SUM(total_cost) as total_cost,
      AVG(tokens_used) as avg_tokens
    FROM business_costs
    GROUP BY step
    ORDER BY total_cost DESC
  `).all();

  // Most expensive businesses
  const mostExpensive = db.prepare(`
    SELECT bc.business_id, b.name, SUM(bc.total_cost) as total_cost, SUM(bc.tokens_used) as tokens
    FROM business_costs bc
    LEFT JOIN businesses b ON b.id = bc.business_id
    GROUP BY bc.business_id
    ORDER BY total_cost DESC
    LIMIT 5
  `).all();

  // Total revenue vs total cost
  const totalRevenue = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM sales').get().total;
  const totalCost = db.prepare('SELECT COALESCE(SUM(total_cost), 0) as total FROM business_costs').get().total;

  // Recent price history from agent logs
  const priceHistory = db.prepare(
    "SELECT message, created_at FROM agent_logs WHERE agent_name = 'Pricer' AND status = 'success' ORDER BY created_at DESC LIMIT 10"
  ).all();

  res.json({
    currentPrice: parseInt(currentPrice?.value) || 50,
    avgCostPerBusiness: parseFloat(avgCost?.value) || 0,
    sampleSize: parseInt(sampleSize?.value) || 0,
    profitMargin: 5,
    byStep,
    mostExpensive,
    totalRevenue,
    totalCost,
    netProfit: totalRevenue - totalCost,
    priceHistory,
  });
});

// Get price for specific business
router.get('/pricing/:businessId', (req, res) => {
  const db = getDb();
  const businessId = parseInt(req.params.businessId);

  const costs = db.prepare(`
    SELECT step, agent_name, tokens_used, token_cost, api_cost, total_cost, model, created_at
    FROM business_costs WHERE business_id = ? ORDER BY created_at
  `).all(businessId);

  const total = costs.reduce((sum, c) => sum + c.total_cost, 0);
  const totalTokens = costs.reduce((sum, c) => sum + c.tokens_used, 0);

  let price = Math.max(total + 150, total * 5);
  price = Math.min(300, price);
  price = Math.round(price / 5) * 5;
  price = Math.max(150, price);

  const business = db.prepare('SELECT name, category FROM businesses WHERE id = ?').get(businessId);

  res.json({
    businessId,
    businessName: business?.name,
    category: business?.category,
    steps: costs,
    totalCost: total,
    totalTokens,
    suggestedPrice: price,
  });
});

// Scheduled calls — populated by the Calendly webhook. Each row represents
// a booked call where we need to build (or have already built) a demo site.
router.get('/scheduled-calls', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT sc.id, sc.scheduled_at, sc.booker_name, sc.booker_email, sc.status,
           sc.business_id, sc.site_id,
           b.name as business_name, b.category, b.address, b.phone,
           b.rating, b.review_count,
           s.preview_url, s.html_path
    FROM scheduled_calls sc
    LEFT JOIN businesses b ON b.id = sc.business_id
    LEFT JOIN sites s ON s.id = sc.site_id
    ORDER BY sc.scheduled_at ASC
  `).all();
  res.json(rows);
});

// Calendly webhook. Expects the `invitee.created` event payload. In the
// user's Calendly booking form we ask for the business email or phone in
// the "questions and answers" section; we use that to match to a lead.
router.post('/calendly/webhook', async (req, res) => {
  const db = getDb();
  const event = req.body?.event;
  const payload = req.body?.payload;

  if (event !== 'invitee.created' || !payload) {
    return res.json({ ok: true, ignored: true });
  }

  const bookerEmail = payload.email || payload.invitee?.email;
  const bookerName = payload.name || payload.invitee?.name;
  const scheduledAt = payload.scheduled_event?.start_time || payload.event?.start_time;
  const providerEventId = payload.uri || payload.scheduled_event?.uri;

  // Match by booker email first (most reliable — it's the owner_email we pitched).
  let business = db.prepare('SELECT * FROM businesses WHERE owner_email = ?').get(bookerEmail);

  // Fallback: look for a "business email" or "phone" answer in Calendly's Q&A.
  if (!business && Array.isArray(payload.questions_and_answers)) {
    const qa = payload.questions_and_answers;
    const phoneAnswer = qa.find((q) => /phone/i.test(q.question))?.answer;
    const emailAnswer = qa.find((q) => /email/i.test(q.question))?.answer;
    if (emailAnswer) {
      business = db.prepare('SELECT * FROM businesses WHERE owner_email = ?').get(emailAnswer);
    }
    if (!business && phoneAnswer) {
      business = db.prepare('SELECT * FROM businesses WHERE phone = ?').get(phoneAnswer);
    }
  }

  if (!business) {
    // Stage the booking anyway — a human can reconcile it from the dashboard.
    return res.status(202).json({ ok: true, matched: false });
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO scheduled_calls (business_id, scheduled_at, booker_name, booker_email, provider, provider_event_id, status)
    VALUES (?, ?, ?, ?, 'calendly', ?, 'scheduled')
  `).run(business.id, scheduledAt, bookerName, bookerEmail, providerEventId);

  const callId = insert.lastInsertRowid;

  // Kick off the demo build asynchronously so the response returns fast.
  // (Calendly retries on non-2xx, so we don't want to hold it open.)
  buildDemoForBusiness(business.id, { reason: 'call_booked' })
    .then(({ siteId }) => {
      getDb()
        .prepare('UPDATE scheduled_calls SET site_id = ?, status = ? WHERE id = ?')
        .run(siteId, 'demo_built', callId);
    })
    .catch((err) => {
      console.error('[Webhook] Demo build failed:', err.message);
      getDb()
        .prepare('UPDATE scheduled_calls SET status = ? WHERE id = ?')
        .run('demo_failed', callId);
    });

  res.json({ ok: true, matched: true, callId, businessId: business.id });
});

// Manual "build demo now" trigger for the Scheduled Calls tab.
router.post('/scheduled-calls/:id/build-demo', async (req, res) => {
  const db = getDb();
  const call = db.prepare('SELECT * FROM scheduled_calls WHERE id = ?').get(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });

  try {
    const { siteId, previewUrl } = await buildDemoForBusiness(call.business_id, { reason: 'manual' });
    db.prepare('UPDATE scheduled_calls SET site_id = ?, status = ? WHERE id = ?')
      .run(siteId, 'demo_built', call.id);
    res.json({ ok: true, siteId, previewUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
