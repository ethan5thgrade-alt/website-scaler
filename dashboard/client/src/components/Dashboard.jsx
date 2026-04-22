import { useState, useEffect } from 'react';
import StatsCards from './StatsCards.jsx';
import DeployButton from './DeployButton.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import IssuesPanel from './IssuesPanel.jsx';
import SalesTracker from './SalesTracker.jsx';
import SecurityPanel from './SecurityPanel.jsx';
import CostMeter from './CostMeter.jsx';

export default function Dashboard({ ws }) {
  const [stats, setStats] = useState({
    sitesBuilt: 0, emailsSent: 0, emailsDelivered: 0, emailsOpened: 0,
    emailsReplied: 0, salesCount: 0, revenue: 0, activePipelines: 0,
    tokensToday: 0, buildsPerDay: [],
  });
  const [pipelineStatus, setPipelineStatus] = useState({ running: false, agents: [] });
  const [activity, setActivity] = useState([]);
  const [issues, setIssues] = useState({ active: [], resolved: [] });
  const [sales, setSales] = useState({ sales: [], totalRevenue: 0 });
  const [agents, setAgents] = useState([]);
  const [heartbeats, setHeartbeats] = useState({ agents: [], sentinelUptime: 0 });

  // Initial data fetch
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAll() {
    try {
      const [statsRes, statusRes, activityRes, issuesRes, salesRes, agentsRes] = await Promise.all([
        fetch('/api/stats').then((r) => r.json()),
        fetch('/api/pipeline/status').then((r) => r.json()),
        fetch('/api/activity?limit=100').then((r) => r.json()),
        fetch('/api/issues').then((r) => r.json()),
        fetch('/api/sales').then((r) => r.json()),
        fetch('/api/agents').then((r) => r.json()),
      ]);
      setStats(statsRes);
      setPipelineStatus(statusRes);
      setActivity(activityRes);
      setIssues(issuesRes);
      setSales(salesRes);
      setAgents(agentsRes);
    } catch (err) {
      console.warn('Failed to fetch data:', err);
    }
  }

  // Live WebSocket updates
  useEffect(() => {
    if (!ws) return;

    const unsubs = [
      ws.on('activity', (data) => {
        setActivity((prev) => [{ ...data, id: Date.now(), created_at: data.timestamp }, ...prev].slice(0, 200));
      }),
      ws.on('pipeline_status', (data) => {
        setPipelineStatus((prev) => ({ ...prev, running: data.status === 'running' }));
        fetchAll();
      }),
      ws.on('heartbeat_grid', (data) => {
        setHeartbeats(data);
      }),
      ws.on('issue', () => {
        fetch('/api/issues').then((r) => r.json()).then(setIssues);
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [ws]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Deploy Button */}
      <DeployButton
        running={pipelineStatus.running}
        onStatusChange={() => fetchAll()}
      />

      {/* Stats Cards + Cost Meter */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <StatsCards stats={stats} heartbeats={heartbeats} />
        </div>
        <div>
          <CostMeter ws={ws} />
        </div>
      </div>

      {/* Middle Row: Activity + Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed activity={activity} />
        </div>
        <div>
          <IssuesPanel issues={issues} onRetry={() => fetchAll()} />
        </div>
      </div>

      {/* Bottom Row: Sales + Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesTracker sales={sales} onSimulate={() => fetchAll()} />
        <SecurityPanel agents={agents} heartbeats={heartbeats} />
      </div>
    </div>
  );
}
