import { getDb } from '../database.js';

export class BaseAgent {
  constructor(name, broadcast) {
    this.name = name;
    this.broadcast = broadcast;
    this.status = 'offline';
    this.tasksCompleted = 0;
    this.startTime = null;
    this.lastHeartbeat = null;
  }

  async start() {
    this.status = 'online';
    this.startTime = Date.now();
    this.updateDbStatus('online');
    this.log('Agent started', 'success');
    this.heartbeat();
  }

  async stop() {
    this.status = 'offline';
    this.updateDbStatus('offline');
    this.log('Agent stopped', 'info');
  }

  heartbeat() {
    this.lastHeartbeat = Date.now();
    const db = getDb();
    db.prepare(
      'UPDATE agent_status SET last_heartbeat = CURRENT_TIMESTAMP, tasks_completed = ? WHERE agent_name = ?'
    ).run(this.tasksCompleted, this.name);
  }

  log(message, status = 'info') {
    const db = getDb();
    db.prepare(
      'INSERT INTO agent_logs (agent_name, action, status, message) VALUES (?, ?, ?, ?)'
    ).run(this.name, message, status, message);

    // Structured stdout log — picked up by log shippers (CloudWatch, Loki,
    // Datadog) and trivial to grep locally.
    const level = status === 'error' ? 'error' : status === 'warning' ? 'warn' : 'info';
    console.log(JSON.stringify({
      level, ts: new Date().toISOString(), agent: this.name, status, message,
    }));

    this.broadcast('activity', {
      agent: this.name,
      action: message,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  logIssue(description, severity = 'warning', suggestedFix = '') {
    const db = getDb();
    db.prepare(
      'INSERT INTO issues (severity, agent_name, description, suggested_fix) VALUES (?, ?, ?, ?)'
    ).run(severity, this.name, description, suggestedFix);

    this.broadcast('issue', { severity, agent: this.name, description, suggestedFix });
  }

  resolveIssues() {
    const db = getDb();
    db.prepare(
      'UPDATE issues SET resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE agent_name = ? AND resolved = 0'
    ).run(this.name);
  }

  updateDbStatus(status) {
    const db = getDb();
    db.prepare(
      'UPDATE agent_status SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_name = ?'
    ).run(status, this.name);
  }

  completeTask() {
    this.tasksCompleted++;
    this.heartbeat();
  }
}
