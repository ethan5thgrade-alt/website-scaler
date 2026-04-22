import { BaseAgent } from './BaseAgent.js';
import { getDb, getSetting } from '../database.js';

// Approximate cost per 1K tokens by model
const COST_PER_1K = {
  'claude-sonnet-4-6': 0.003,
  'gpt-4o': 0.005,
  'gpt-4o-mini': 0.00015,
  default: 0.003,
};

export class Accountant extends BaseAgent {
  constructor(broadcast) {
    super('Accountant', broadcast);
    this.alertThreshold = 0.8; // warn at 80% budget
    this.hasWarned = false;
  }

  async start() {
    await super.start();
    this.monitorInterval = setInterval(() => this.checkBudget(), 30000);
  }

  async stop() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    await super.stop();
  }

  trackUsage(agentName, tokens, model = 'default') {
    const db = getDb();
    const costPer1K = COST_PER_1K[model] || COST_PER_1K.default;
    const cost = (tokens / 1000) * costPer1K;

    db.prepare(
      'INSERT INTO token_usage (agent_name, tokens_used, cost_estimate, model) VALUES (?, ?, ?, ?)'
    ).run(agentName, tokens, cost, model);

    this.broadcast('token_usage', {
      agent: agentName,
      tokens,
      cost,
      timestamp: new Date().toISOString(),
    });

    this.heartbeat();
  }

  checkBudget() {
    const db = getDb();
    const dailyLimit = parseInt(getSetting('daily_token_limit')) || 5000000;

    const today = db.prepare(
      "SELECT COALESCE(SUM(tokens_used), 0) as total, COALESCE(SUM(cost_estimate), 0) as cost FROM token_usage WHERE date(created_at) = date('now')"
    ).get();

    const usage = today.total / dailyLimit;

    if (usage >= this.alertThreshold && !this.hasWarned) {
      this.log(`Token budget at ${Math.round(usage * 100)}% — approaching limit`, 'warning');
      this.logIssue(
        `Token usage at ${Math.round(usage * 100)}% of daily limit`,
        'warning',
        'Consider reducing pipeline throughput or increasing budget'
      );
      this.hasWarned = true;
    }

    if (usage >= 1.0) {
      this.log('Token budget EXCEEDED — throttling agents', 'error');
      this.broadcast('budget_exceeded', { usage: today.total, limit: dailyLimit });
    }

    // Reset warning flag at midnight (approximate)
    const hour = new Date().getHours();
    if (hour === 0) this.hasWarned = false;

    return {
      tokensUsed: today.total,
      costEstimate: today.cost,
      dailyLimit,
      usagePercent: Math.round(usage * 100),
    };
  }

  getReport() {
    const db = getDb();

    const byAgent = db.prepare(
      "SELECT agent_name, SUM(tokens_used) as tokens, SUM(cost_estimate) as cost FROM token_usage WHERE date(created_at) = date('now') GROUP BY agent_name ORDER BY tokens DESC"
    ).all();

    const sitesBuilt = db.prepare("SELECT COUNT(*) as c FROM sites WHERE status = 'completed'").get().c;
    const emailsSent = db.prepare("SELECT COUNT(*) as c FROM emails WHERE status = 'sent'").get().c;

    const totalCost = byAgent.reduce((sum, a) => sum + a.cost, 0);

    return {
      byAgent,
      totalCost,
      costPerSite: sitesBuilt > 0 ? totalCost / sitesBuilt : 0,
      costPerEmail: emailsSent > 0 ? totalCost / emailsSent : 0,
      mostExpensive: byAgent[0] || null,
    };
  }
}
