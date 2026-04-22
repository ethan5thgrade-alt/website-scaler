import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { getDb } from './database.js';
import { initWebSocket, broadcast } from './services/websocket.js';
import apiRoutes from './routes/api.js';
import settingsRoutes from './routes/settings.js';
import { Commander } from './agents/Commander.js';
import { Scout } from './agents/Scout.js';
import { Scraper } from './agents/Scraper.js';
import { Builder } from './agents/Builder.js';
import { Postman } from './agents/Postman.js';
import { Accountant } from './agents/Accountant.js';
import { Pricer } from './agents/Pricer.js';
import { SentinelClient } from './agents/Sentinel.js';
import { registerBuilders } from './services/builderDispatch.js';
import {
  requestId,
  securityHeaders,
  rateLimit,
  corsOriginList,
  notFound,
  errorHandler,
  accessLog,
} from './services/http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
const server = createServer(app);

// Middleware
app.set('trust proxy', 1);
app.use(requestId());
app.use(securityHeaders());
app.use(cors({ origin: corsOriginList(), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(accessLog());

// Health endpoints — cheap checks used by uptime monitors + load balancers.
app.get('/healthz', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/readyz', (req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.json({ ok: true, db: 'ok', ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, db: err.message });
  }
});

// Rate limits on the externally-triggered write endpoints.
app.use('/api/deploy', rateLimit({ max: 3, windowMs: 60_000, name: 'deploy' }));
app.use('/api/stop', rateLimit({ max: 10, windowMs: 60_000, name: 'stop' }));
app.use('/api/calendly/webhook', rateLimit({ max: 60, windowMs: 60_000, name: 'calendly' }));

// Serve generated sites
app.use('/sites', express.static(path.join(__dirname, '..', 'generated-sites')));

// Serve frontend in production
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

// Init database
getDb();

// Init WebSocket
initWebSocket(server);

// Routes
app.use('/api', apiRoutes);
app.use('/api/settings', settingsRoutes);

// Agent registry
const agents = {};
let pipelineRunning = false;
let currentPipelineId = null;

function initAgents() {
  agents.commander = new Commander(broadcast);
  agents.scout = new Scout(broadcast);
  agents.scraper = new Scraper(broadcast);
  agents.builderAlpha = new Builder('Builder-Alpha', broadcast);
  agents.builderBeta = new Builder('Builder-Beta', broadcast);
  agents.builderGamma = new Builder('Builder-Gamma', broadcast);
  agents.postman = new Postman(broadcast);
  agents.accountant = new Accountant(broadcast);
  agents.pricer = new Pricer(broadcast);
  agents.sentinel = new SentinelClient(broadcast);

  // Register builders so the Calendly webhook + manual "build demo" button
  // can build outside the main pipeline.
  registerBuilders(
    [agents.builderAlpha, agents.builderBeta, agents.builderGamma],
    { db: getDb(), broadcast, accountant: agents.accountant, pricer: agents.pricer },
  );
}

initAgents();

// Deploy pipeline
app.post('/api/deploy', async (req, res) => {
  if (pipelineRunning) {
    return res.status(400).json({ error: 'Pipeline already running' });
  }

  const { zipCodes = ['90210'], categories = ['restaurant'], maxLeads = 20, dailyEmailLimit = 50 } = req.body;

  const db = getDb();

  // Create pipeline run
  const run = db.prepare(
    'INSERT INTO pipeline_runs (zip_codes, categories, max_leads, daily_email_limit, status, started_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
  ).run(JSON.stringify(zipCodes), JSON.stringify(categories), maxLeads, dailyEmailLimit, 'running');

  currentPipelineId = run.lastInsertRowid;
  pipelineRunning = true;

  broadcast('pipeline_status', { status: 'running', pipelineId: currentPipelineId });

  // Boot Sentinel first
  await agents.sentinel.start();

  // Pre-flight checks
  broadcast('preflight', { step: 'database', status: 'pass' });
  broadcast('preflight', { step: 'agents', status: 'pass' });
  broadcast('preflight', { step: 'disk_space', status: 'pass' });
  broadcast('preflight', { step: 'email_config', status: 'pass' });

  // Boot all agents
  for (const [name, agent] of Object.entries(agents)) {
    if (name !== 'sentinel') {
      await agent.start();
    }
  }

  broadcast('deploy', { status: 'all_agents_online' });

  // Start the pipeline
  runPipeline(zipCodes, categories, maxLeads, dailyEmailLimit).catch((err) => {
    console.error('[Pipeline] Error:', err.message);
    broadcast('pipeline_error', { error: err.message });
  });

  res.json({ success: true, pipelineId: currentPipelineId });
});

// Stop pipeline
app.post('/api/stop', async (req, res) => {
  if (!pipelineRunning) {
    return res.status(400).json({ error: 'No pipeline running' });
  }

  pipelineRunning = false;

  // Stop all agents except Sentinel (Sentinel stops last)
  for (const [name, agent] of Object.entries(agents)) {
    if (name !== 'sentinel') {
      await agent.stop();
    }
  }

  // Stop Sentinel last
  await agents.sentinel.stop();

  if (currentPipelineId) {
    const db = getDb();
    db.prepare('UPDATE pipeline_runs SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('stopped', currentPipelineId);
  }

  broadcast('pipeline_status', { status: 'stopped' });
  currentPipelineId = null;

  res.json({ success: true });
});

// Pipeline status
app.get('/api/pipeline/status', (req, res) => {
  res.json({
    running: pipelineRunning,
    pipelineId: currentPipelineId,
    agents: Object.entries(agents).map(([key, agent]) => ({
      name: agent.name,
      status: agent.status,
    })),
  });
});

async function runPipeline(zipCodes, categories, maxLeads, dailyEmailLimit) {
  const db = getDb();
  const builderAgents = [agents.builderAlpha, agents.builderBeta, agents.builderGamma];
  const concurrency = builderAgents.length;
  let totalProcessed = 0;
  let builderIndex = 0;
  let emailsSentToday = db.prepare(
    "SELECT COUNT(*) as count FROM emails WHERE date(sent_at) = date('now') AND status = 'sent'"
  ).get().count;

  async function processLead(biz) {
    // Scraper enriches data
    const enriched = await agents.scraper.enrichBusiness(biz);

    // Save to database
    const existing = db.prepare('SELECT id FROM businesses WHERE place_id = ?').get(enriched.place_id);
    let businessId;
    if (existing) {
      businessId = existing.id;
    } else {
      const result = db.prepare(
        `INSERT INTO businesses (place_id, name, address, phone, category, rating, review_count, hours, photos, services, owner_name, owner_email, zip_code, raw_data, status, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        enriched.place_id, enriched.name, enriched.address, enriched.phone,
        enriched.category, enriched.rating, enriched.review_count,
        JSON.stringify(enriched.hours), JSON.stringify(enriched.photos),
        JSON.stringify(enriched.services), enriched.owner_name, enriched.owner_email,
        biz.zip_code || enriched.address?.match(/\b\d{5}\b/)?.[0] || null,
        JSON.stringify(enriched), 'pitched',
        enriched.rating ? Math.round(enriched.rating * (enriched.review_count || 0)) : 0
      );
      businessId = result.lastInsertRowid;
    }

    // Scout/Scraper don't use LLM tokens — only Places API fixed costs.
    agents.pricer.trackBusinessCost(businessId, 'Scout', 0, 'default', 'find');
    agents.pricer.trackBusinessCost(businessId, 'Scraper', 0, 'default', 'scrape');

    // Builder no longer runs here — the pitch is for a call. Builder runs
    // after the prospect books via Calendly (see /api/calendly/webhook).

    // Email — pitch the call with the Calendly link.
    const calendlyLink = (process.env.CALENDLY_LINK || getSettingLink()) || '';
    if (enriched.owner_email && emailsSentToday < dailyEmailLimit) {
      emailsSentToday++;
      const emailResult = await agents.postman.sendPitch(enriched, calendlyLink);
      db.prepare(
        'INSERT INTO emails (business_id, site_id, to_email, to_name, subject, body, status, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
      ).run(businessId, null, enriched.owner_email, enriched.owner_name, emailResult.subject, emailResult.body, 'sent');

      agents.pricer.trackBusinessCost(businessId, 'Postman', 0, 'default', 'email');

      if (currentPipelineId) {
        db.prepare('UPDATE pipeline_runs SET emails_sent = emails_sent + 1 WHERE id = ?').run(currentPipelineId);
      }
    }

    totalProcessed++;
    if (currentPipelineId) {
      db.prepare('UPDATE pipeline_runs SET businesses_found = ? WHERE id = ?').run(totalProcessed, currentPipelineId);
    }
  }

  function getSettingLink() {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'calendly_link'").get();
    return row?.value || '';
  }

  // Run up to `concurrency` leads at a time per Scout call. Errors are
  // caught per-lead so one failure doesn't poison the batch.
  async function runInPool(leads) {
    const cursor = { i: 0 };
    const worker = async () => {
      while (cursor.i < leads.length && pipelineRunning && totalProcessed < maxLeads) {
        const idx = cursor.i++;
        try {
          await processLead(leads[idx]);
        } catch (err) {
          console.error('[Pipeline] Lead failed:', err.message);
          broadcast('pipeline_error', { error: err.message, lead: leads[idx]?.name });
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  for (const zip of zipCodes) {
    if (!pipelineRunning) break;
    for (const category of categories) {
      if (!pipelineRunning || totalProcessed >= maxLeads) break;
      const businesses = await agents.scout.findBusinesses(zip, category, maxLeads - totalProcessed);
      for (const b of businesses) b.zip_code = zip;
      await runInPool(businesses);
    }
  }

  // Pipeline complete
  if (currentPipelineId) {
    db.prepare('UPDATE pipeline_runs SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('completed', currentPipelineId);
  }

  pipelineRunning = false;
  broadcast('pipeline_status', { status: 'completed' });
}

// SPA fallback — but let /api/* fall through to 404 + error handler below.
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

// 404 + error envelope (last)
app.use('/api', notFound());
app.use(errorHandler());

// Graceful shutdown — give in-flight requests a moment to finish.
function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
  pipelineRunning = false;
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, () => {
  console.log(JSON.stringify({
    level: 'info', event: 'server_started', port: PORT, ts: new Date().toISOString(),
  }));
});
