import { BaseAgent } from './BaseAgent.js';
import { getDb } from '../database.js';

export class Commander extends BaseAgent {
  constructor(broadcast) {
    super('Commander', broadcast);
    this.systemPrompt = `You are the master orchestrator of an automated business pipeline. You manage 9 sub-agents. Your job is to keep the pipeline flowing efficiently. Monitor all agents for failures and bottlenecks. Distribute website build jobs evenly across 3 builder agents. Prioritize businesses with higher Google ratings and more reviews. If any agent fails 3 times on the same task, flag it for human review. Report a status summary every 100 tasks processed.`;
    this.failureCounters = new Map();
    this.decisionsLog = [];
  }

  async start() {
    await super.start();
    this.log('Commander online — orchestrating pipeline', 'success');
  }

  log(message, status = 'info') {
    super.log(message, status);
    this.decisionsLog.push({
      timestamp: new Date().toISOString(),
      message,
      status,
    });
    if (this.decisionsLog.length > 200) {
      this.decisionsLog.shift();
    }
  }

  trackFailure(agentName, taskId) {
    const key = `${agentName}:${taskId}`;
    const count = (this.failureCounters.get(key) || 0) + 1;
    this.failureCounters.set(key, count);

    if (count >= 3) {
      this.log(`${agentName} failed 3 times on task ${taskId} — flagging for human review`, 'error');
      this.logIssue(
        `${agentName} failed 3 times on task ${taskId}`,
        'error',
        'Review the task manually or reassign to a different agent'
      );
      return true; // escalate
    }
    return false;
  }

  getDecisions() {
    return this.decisionsLog;
  }

  selectBuilder(builders) {
    // Round-robin with availability check
    const available = builders.filter((b) => b.status === 'online');
    if (available.length === 0) {
      this.log('No builders available — queuing job', 'warning');
      return null;
    }
    // Pick the one with fewest tasks completed (load balance)
    available.sort((a, b) => a.tasksCompleted - b.tasksCompleted);
    return available[0];
  }

  prioritizeBusinesses(businesses) {
    return [...businesses].sort((a, b) => {
      const scoreA = (a.rating || 0) * (a.review_count || 0);
      const scoreB = (b.rating || 0) * (b.review_count || 0);
      return scoreB - scoreA;
    });
  }

  generateStatusSummary() {
    const db = getDb();
    const stats = {
      sitesBuilt: db.prepare("SELECT COUNT(*) as c FROM sites WHERE status = 'completed'").get().c,
      emailsSent: db.prepare("SELECT COUNT(*) as c FROM emails WHERE status = 'sent'").get().c,
      businessesProcessed: db.prepare("SELECT COUNT(*) as c FROM businesses WHERE status != 'discovered'").get().c,
      activeIssues: db.prepare('SELECT COUNT(*) as c FROM issues WHERE resolved = 0').get().c,
    };
    this.log(`Status: ${stats.sitesBuilt} sites, ${stats.emailsSent} emails, ${stats.businessesProcessed} businesses, ${stats.activeIssues} issues`, 'info');
    return stats;
  }
}
