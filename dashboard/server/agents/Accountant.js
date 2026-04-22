import { BaseAgent } from './BaseAgent.js';
import { getDb } from '../database.js';
import {
  getTodaySpendCents,
  getDailyCapCents,
  breakdownToday,
  isOverBudget,
} from '../services/cost-tracker.js';

export class Accountant extends BaseAgent {
  constructor(broadcast) {
    super('Accountant', broadcast);
    this.warnedAt80 = false;
    this.warnedAt95 = false;
  }

  async start() {
    await super.start();
    // Poll every 10s to emit status + catch overspend early.
    this.monitorInterval = setInterval(() => this.tick(), 10000);
  }

  async stop() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    await super.stop();
  }

  // Legacy shim — some call sites still use `trackUsage(name, tokens)`.
  // The real accounting now happens inside each agent via cost-tracker; this
  // stub just writes a zero-cost row so the activity feed keeps flowing.
  trackUsage(agentName, _tokens, _model) {
    this.heartbeat();
    this.broadcast('token_usage', { agent: agentName, timestamp: new Date().toISOString() });
  }

  tick() {
    const todayCents = getTodaySpendCents();
    const capCents = getDailyCapCents();
    const pct = capCents > 0 ? todayCents / capCents : 0;

    this.broadcast('budget_tick', {
      today_cents: todayCents,
      cap_cents: capCents,
      pct: Math.round(pct * 10000) / 100,
      breakdown: breakdownToday(),
    });

    if (capCents > 0 && pct >= 0.8 && !this.warnedAt80) {
      this.log(`Daily budget at ${Math.round(pct * 100)}% of $${capCents / 100}`, 'warning');
      this.logIssue(
        `Daily spend at ${Math.round(pct * 100)}% of cap`,
        'warning',
        'Consider pausing the pipeline or raising daily_budget_usd in Settings.',
      );
      this.warnedAt80 = true;
    }
    if (capCents > 0 && pct >= 0.95 && !this.warnedAt95) {
      this.log(`Daily budget at ${Math.round(pct * 100)}% — close to hard stop`, 'error');
      this.warnedAt95 = true;
    }
    if (isOverBudget()) {
      this.log(`Daily budget HIT — signalling pipeline to stop`, 'error');
      this.broadcast('budget_exceeded', {
        today_cents: todayCents,
        cap_cents: capCents,
      });
    }

    // Reset warnings near midnight so a new day starts clean.
    const hour = new Date().getHours();
    if (hour === 0) {
      this.warnedAt80 = false;
      this.warnedAt95 = false;
    }

    this.heartbeat();
  }

  getReport() {
    const db = getDb();
    const byAgent = breakdownToday();
    const sitesBuilt = db.prepare("SELECT COUNT(*) as c FROM sites WHERE status = 'completed'").get().c;
    const emailsSent = db.prepare("SELECT COUNT(*) as c FROM emails WHERE status = 'sent'").get().c;

    const totalCents = byAgent.reduce((sum, a) => sum + a.cents, 0);

    return {
      byAgent,
      totalCents,
      totalDollars: (totalCents / 100).toFixed(2),
      costPerSiteCents: sitesBuilt > 0 ? Math.round(totalCents / sitesBuilt) : 0,
      costPerEmailCents: emailsSent > 0 ? Math.round(totalCents / emailsSent) : 0,
      mostExpensive: byAgent.sort((a, b) => b.cents - a.cents)[0] || null,
    };
  }
}
