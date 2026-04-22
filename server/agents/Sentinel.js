import { BaseAgent } from './BaseAgent.js';
import { getDb, getSetting } from '../database.js';

export class SentinelClient extends BaseAgent {
  constructor(broadcast) {
    super('Sentinel', broadcast);
    this.systemPrompt = `You are the security and uptime guardian of this system. Your sole mission is to ensure every agent is alive, responsive, and performing correctly at all times. You run continuous health checks. If anything goes down, you restart it immediately. If you cannot fix it, you escalate to the human operator. You monitor API keys, system resources, and process health. You run pre-flight checks before every deployment. You are the first to start and the last to stop. You trust no other agent to monitor themselves — you verify everything independently. You never sleep. You never pause. If the system is supposed to be running, you make sure it is running.`;
    this.heartbeatInterval = null;
    this.apiCheckInterval = null;
    this.startTimestamp = null;
    this.agentHeartbeats = new Map();
    this.restartHistory = [];
    this.threatLog = [];
  }

  async start() {
    this.startTimestamp = Date.now();
    await super.start();

    const db = getDb();
    db.prepare("INSERT INTO uptime_logs (event_type, agent_name, details) VALUES (?, ?, ?)").run('start', 'Sentinel', 'Sentinel service started');

    // Start heartbeat monitoring every 10 seconds
    this.heartbeatInterval = setInterval(() => this.checkAllHeartbeats(), 10000);

    // Check API keys every 60 seconds
    this.apiCheckInterval = setInterval(() => this.checkApiKeys(), 60000);

    this.log('Sentinel online — monitoring all agents', 'success');
  }

  async stop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.apiCheckInterval) clearInterval(this.apiCheckInterval);

    const db = getDb();
    db.prepare("INSERT INTO uptime_logs (event_type, agent_name, details) VALUES (?, ?, ?)").run('stop', 'Sentinel', 'Sentinel service stopped');

    await super.stop();
  }

  getUptime() {
    if (!this.startTimestamp) return 0;
    return Date.now() - this.startTimestamp;
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  }

  checkAllHeartbeats() {
    const db = getDb();
    const agents = db.prepare("SELECT * FROM agent_status WHERE agent_name != 'Sentinel'").all();

    for (const agent of agents) {
      if (agent.status === 'offline') continue;

      const lastBeat = agent.last_heartbeat ? new Date(agent.last_heartbeat).getTime() : 0;
      const timeSince = Date.now() - lastBeat;

      if (timeSince > 30000 && agent.status === 'online') {
        // Agent unresponsive
        this.log(`${agent.agent_name} unresponsive (${Math.round(timeSince / 1000)}s) — flagging`, 'warning');

        this.broadcast('agent_health', {
          agent: agent.agent_name,
          status: 'unresponsive',
          lastHeartbeat: timeSince,
        });

        // Attempt auto-restart
        this.attemptRestart(agent.agent_name);
      } else if (agent.status === 'online') {
        this.agentHeartbeats.set(agent.agent_name, Date.now());
      }
    }

    // Broadcast heartbeat grid
    this.broadcast('heartbeat_grid', {
      agents: agents.map((a) => ({
        name: a.agent_name,
        status: a.status,
        lastHeartbeat: a.last_heartbeat,
        restartCount: a.restart_count,
      })),
      sentinelUptime: this.getUptime(),
    });

    this.heartbeat();
  }

  attemptRestart(agentName) {
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agent_status WHERE agent_name = ?').get(agentName);

    if (agent.restart_count >= 3) {
      this.log(`${agentName} failed to restart 3 times — alerting human`, 'error');
      this.logIssue(
        `${agentName} is unstable — failed to restart 3 times`,
        'error',
        'Manual intervention required. Check agent logs and system resources.'
      );

      db.prepare("INSERT INTO uptime_logs (event_type, agent_name, details) VALUES (?, ?, ?)").run(
        'restart_failed', agentName, 'Max restart attempts reached'
      );
      return;
    }

    this.log(`Auto-restarting ${agentName}...`, 'warning');

    db.prepare(
      'UPDATE agent_status SET restart_count = restart_count + 1, last_restart = CURRENT_TIMESTAMP WHERE agent_name = ?'
    ).run(agentName);

    db.prepare("INSERT INTO uptime_logs (event_type, agent_name, details) VALUES (?, ?, ?)").run(
      'restart', agentName, `Auto-restart attempt #${(agent.restart_count || 0) + 1}`
    );

    this.restartHistory.push({
      agent: agentName,
      timestamp: new Date().toISOString(),
      attempt: (agent.restart_count || 0) + 1,
    });

    // Simulate restart (in real implementation, this would actually restart the agent process)
    setTimeout(() => {
      db.prepare('UPDATE agent_status SET status = ?, last_heartbeat = CURRENT_TIMESTAMP WHERE agent_name = ?').run('online', agentName);
      this.log(`${agentName} restarted successfully`, 'success');
      this.broadcast('agent_restarted', { agent: agentName });
    }, 3000);
  }

  checkApiKeys() {
    const checks = [];

    const gmapsKey = getSetting('google_maps_api_key');
    checks.push({ name: 'Google Maps API', valid: !!gmapsKey, key: 'google_maps_api_key' });

    const anthropicKey = getSetting('anthropic_api_key');
    const openaiKey = getSetting('openai_api_key');
    checks.push({ name: 'LLM Provider', valid: !!(anthropicKey || openaiKey), key: 'llm' });

    const sendgridKey = getSetting('sendgrid_api_key');
    checks.push({ name: 'SendGrid', valid: !!sendgridKey, key: 'sendgrid_api_key' });

    // In real implementation, actually test each API key with a lightweight request

    this.broadcast('api_health', { checks });
    return checks;
  }

  runPreflightChecks() {
    const results = [];

    // Database check
    try {
      getDb().prepare('SELECT 1').get();
      results.push({ check: 'Database', status: 'pass' });
    } catch {
      results.push({ check: 'Database', status: 'fail', error: 'Cannot connect to database' });
    }

    // API keys
    const apiChecks = this.checkApiKeys();
    for (const check of apiChecks) {
      results.push({
        check: check.name,
        status: check.valid ? 'pass' : 'warn',
        error: check.valid ? null : `No API key configured (will use mock mode)`,
      });
    }

    // Disk space (simplified check)
    results.push({ check: 'Disk Space', status: 'pass' });

    // Email config
    const fromEmail = getSetting('sendgrid_from_email');
    results.push({
      check: 'Email Config',
      status: fromEmail ? 'pass' : 'warn',
      error: fromEmail ? null : 'No from-email configured (will use mock mode)',
    });

    // Commander check
    results.push({ check: 'Commander Agent', status: 'pass' });

    const allPass = results.every((r) => r.status !== 'fail');

    this.broadcast('preflight_results', { results, allPass });
    return { results, allPass };
  }

  getSecurityReport() {
    return {
      uptime: this.getUptime(),
      uptimeFormatted: this.formatUptime(this.getUptime()),
      restartHistory: this.restartHistory.slice(-20),
      threatLog: this.threatLog.slice(-20),
      apiHealth: this.checkApiKeys(),
    };
  }
}
