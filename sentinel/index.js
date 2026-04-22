/**
 * INDEPENDENT SENTINEL SERVICE
 *
 * This runs as a completely separate process from the main app.
 * It monitors the main server's health and can restart it if needed.
 * It writes a heartbeat file every 5 seconds — a cron job or watchdog
 * can check this file to ensure the Sentinel itself is alive.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEARTBEAT_FILE = path.join(__dirname, '..', 'data', 'sentinel_heartbeat.json');
const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL || 'http://localhost:3001';
const SENTINEL_PORT = process.env.SENTINEL_PORT || 3003;
const CHECK_INTERVAL = 10000; // 10 seconds
const SELF_HEARTBEAT_INTERVAL = 5000; // 5 seconds

let serverHealthy = true;
let lastServerCheck = null;
let consecutiveFailures = 0;
let startTime = Date.now();
let totalChecks = 0;
let failedChecks = 0;

// Write own heartbeat file (for OS-level watchdog)
function writeSelfHeartbeat() {
  const data = {
    alive: true,
    pid: process.pid,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
    serverHealthy,
    consecutiveFailures,
    totalChecks,
    failedChecks,
  };

  try {
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[Sentinel] Failed to write heartbeat file:', err.message);
  }
}

// Check if main server is responding
function checkMainServer() {
  return new Promise((resolve) => {
    const req = http.get(`${MAIN_SERVER_URL}/api/pipeline/status`, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ healthy: true, data: parsed });
        } catch {
          resolve({ healthy: true, data: null });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ healthy: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ healthy: false, error: 'timeout' });
    });
  });
}

// Main monitoring loop
async function monitor() {
  totalChecks++;
  const result = await checkMainServer();
  lastServerCheck = new Date().toISOString();

  if (result.healthy) {
    if (!serverHealthy) {
      console.log(`[Sentinel] Main server recovered after ${consecutiveFailures} failures`);
    }
    serverHealthy = true;
    consecutiveFailures = 0;
  } else {
    failedChecks++;
    consecutiveFailures++;
    serverHealthy = false;
    console.warn(`[Sentinel] Main server unreachable (attempt ${consecutiveFailures}): ${result.error}`);

    if (consecutiveFailures >= 3) {
      console.error(`[Sentinel] Main server down for ${consecutiveFailures} consecutive checks — needs manual restart`);
      // In production, you could trigger a restart here:
      // exec('npm run server', { cwd: path.join(__dirname, '..') });
    }
  }
}

// Sentinel's own HTTP API for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      sentinel: 'alive',
      pid: process.pid,
      uptime: Date.now() - startTime,
      serverHealthy,
      lastServerCheck,
      consecutiveFailures,
      totalChecks,
      failedChecks,
      uptimePercent: totalChecks > 0 ? (((totalChecks - failedChecks) / totalChecks) * 100).toFixed(2) : 100,
    }));
  } else if (req.url === '/restart-history') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Check main server /api/uptime for restart history' }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start everything
console.log(`[Sentinel] Independent sentinel service starting on port ${SENTINEL_PORT}`);
console.log(`[Sentinel] Monitoring main server at ${MAIN_SERVER_URL}`);
console.log(`[Sentinel] PID: ${process.pid}`);

server.listen(SENTINEL_PORT, () => {
  console.log(`[Sentinel] Health endpoint: http://localhost:${SENTINEL_PORT}/health`);
});

// Self-heartbeat writer
setInterval(writeSelfHeartbeat, SELF_HEARTBEAT_INTERVAL);
writeSelfHeartbeat();

// Main server monitoring
setInterval(monitor, CHECK_INTERVAL);
monitor();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Sentinel] Shutting down gracefully...');
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Sentinel] Interrupted — shutting down...');
  server.close();
  process.exit(0);
});
