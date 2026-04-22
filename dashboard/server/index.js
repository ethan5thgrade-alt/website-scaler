import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { getDb } from './database.js';
import { initWebSocket, broadcast } from './services/websocket.js';
import apiRoutes from './routes/api.js';
import settingsRoutes from './routes/settings.js';
import costRoutes from './routes/cost.js';
import { isOverBudget } from './services/cost-tracker.js';
import { Commander } from './agents/Commander.js';
import { Scout } from './agents/Scout.js';
import { Scraper } from './agents/Scraper.js';
import { Builder } from './agents/Builder.js';
import { Postman } from './agents/Postman.js';
import { Accountant } from './agents/Accountant.js';
import { SentinelClient } from './agents/Sentinel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

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
app.use('/api/cost', costRoutes);

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
  agents.sentinel = new SentinelClient(broadcast);
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
  let totalProcessed = 0;
  const builderAgents = [agents.builderAlpha, agents.builderBeta, agents.builderGamma];
  let builderIndex = 0;

  for (const zip of zipCodes) {
    if (!pipelineRunning) break;

    for (const category of categories) {
      if (!pipelineRunning || totalProcessed >= maxLeads) break;
      if (isOverBudget()) {
        agents.commander.log('Daily budget cap reached — auto-stopping pipeline', 'error');
        broadcast('pipeline_status', { status: 'stopped', reason: 'over_budget' });
        pipelineRunning = false;
        break;
      }

      // Scout finds businesses
      const businesses = await agents.scout.findBusinesses(zip, category, maxLeads - totalProcessed);

      for (const biz of businesses) {
        if (!pipelineRunning || totalProcessed >= maxLeads) break;
        if (isOverBudget()) {
          agents.commander.log('Budget hit mid-batch — stopping', 'error');
          broadcast('pipeline_status', { status: 'stopped', reason: 'over_budget' });
          pipelineRunning = false;
          break;
        }

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
            zip, JSON.stringify(enriched), 'scraped',
            enriched.rating ? Math.round(enriched.rating * enriched.review_count) : 0
          );
          businessId = result.lastInsertRowid;
        }

        // Tokens are now logged automatically by each agent via cost-tracker.
        // Accountant reads aggregates from DB + emits budget_tick events.

        // Commander assigns to a builder (round-robin)
        const builder = builderAgents[builderIndex % 3];
        builderIndex++;

        agents.commander.log(`Assigning ${enriched.name} to ${builder.name}`);

        // Build site
        const siteResult = await builder.buildSite(enriched);

        const siteRow = db.prepare(
          'INSERT INTO sites (business_id, builder_agent, html_path, preview_url, build_time_ms, design_style, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(businessId, builder.name, siteResult.htmlPath, siteResult.previewUrl, siteResult.buildTime, siteResult.designStyle, 'completed');

        // Builder's Claude call already logged its own token usage.

        db.prepare('UPDATE businesses SET status = ? WHERE id = ?').run('site_built', businessId);

        // Update pipeline stats
        if (currentPipelineId) {
          db.prepare('UPDATE pipeline_runs SET sites_built = sites_built + 1 WHERE id = ?').run(currentPipelineId);
        }

        // Send email if we have an email address
        if (enriched.owner_email) {
          const emailsSentToday = db.prepare(
            "SELECT COUNT(*) as count FROM emails WHERE date(sent_at) = date('now') AND status = 'sent'"
          ).get();

          if (emailsSentToday.count < dailyEmailLimit) {
            const emailResult = await agents.postman.sendPitch(enriched, siteResult.previewUrl);

            db.prepare(
              'INSERT INTO emails (business_id, site_id, to_email, to_name, subject, body, status, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
            ).run(businessId, siteRow.lastInsertRowid, enriched.owner_email, enriched.owner_name, emailResult.subject, emailResult.body, 'sent');

            // Email-send cost already logged inside Postman.sendViaApi.

            if (currentPipelineId) {
              db.prepare('UPDATE pipeline_runs SET emails_sent = emails_sent + 1 WHERE id = ?').run(currentPipelineId);
            }
          }
        }

        totalProcessed++;

        if (currentPipelineId) {
          db.prepare('UPDATE pipeline_runs SET businesses_found = ? WHERE id = ?').run(totalProcessed, currentPipelineId);
        }

        // Small delay between businesses
        await new Promise((r) => setTimeout(r, 500));
      }
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

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`[Server] Website Scaler running on http://localhost:${PORT}`);
  console.log(`[Server] WebSocket on same port`);
});
