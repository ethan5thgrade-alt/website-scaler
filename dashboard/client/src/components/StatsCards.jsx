import { useState, useEffect } from 'react';

function MiniChart({ data, color = '#3b82f6' }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const width = 80;
  const height = 30;
  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - (d.count / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
}

function StatCard({ title, value, subtitle, chart, color, animate }) {
  return (
    <div className={`card relative overflow-hidden ${animate ? 'animate-ka-ching' : ''}`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="card-header">{title}</div>
          <div className="stat-value" style={{ color }}>{value}</div>
          {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
        </div>
        {chart && <div className="mt-2">{chart}</div>}
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
    </div>
  );
}

export default function StatsCards({ stats, heartbeats }) {
  const [kaChingAnim, setKaChingAnim] = useState(false);
  const [prevRevenue, setPrevRevenue] = useState(0);

  useEffect(() => {
    if (stats.revenue > prevRevenue && prevRevenue > 0) {
      setKaChingAnim(true);
      setTimeout(() => setKaChingAnim(false), 600);
    }
    setPrevRevenue(stats.revenue);
  }, [stats.revenue]);

  const deliveryRate = stats.emailsSent > 0
    ? Math.round((stats.emailsDelivered / stats.emailsSent) * 100) : 0;
  const openRate = stats.emailsSent > 0
    ? Math.round((stats.emailsOpened / stats.emailsSent) * 100) : 0;
  const replyRate = stats.emailsSent > 0
    ? Math.round((stats.emailsReplied / stats.emailsSent) * 100) : 0;

  const tokenLimit = 5000000;
  const tokenPercent = Math.round((stats.tokensToday / tokenLimit) * 100);

  // System health based on heartbeats
  const onlineAgents = heartbeats.agents?.filter((a) => a.status === 'online').length || 0;
  const totalAgents = heartbeats.agents?.length || 9;
  const healthStatus = onlineAgents === totalAgents ? 'green' : onlineAgents > totalAgents / 2 ? 'yellow' : 'red';
  const healthColors = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard
        title="Websites Built"
        value={stats.sitesBuilt}
        chart={<MiniChart data={stats.buildsPerDay} color="#3b82f6" />}
        color="#3b82f6"
      />
      <StatCard
        title="Emails Sent"
        value={stats.emailsSent}
        subtitle={`${deliveryRate}% del / ${openRate}% open / ${replyRate}% reply`}
        color="#8b5cf6"
      />
      <StatCard
        title="Sales Closed"
        value={`$${stats.revenue.toLocaleString()}`}
        subtitle={`${stats.salesCount} sales at $50 each`}
        color="#22c55e"
        animate={kaChingAnim}
      />
      <StatCard
        title="Active Pipelines"
        value={stats.activePipelines}
        color="#f59e0b"
      />
      <StatCard
        title="Token Budget"
        value={`${tokenPercent}%`}
        subtitle={`${(stats.tokensToday / 1000).toFixed(0)}K / ${(tokenLimit / 1000000).toFixed(0)}M`}
        color={tokenPercent > 80 ? '#ef4444' : tokenPercent > 50 ? '#eab308' : '#22c55e'}
      />
      <StatCard
        title="System Health"
        value={healthStatus.toUpperCase()}
        subtitle={`${onlineAgents}/${totalAgents} agents online`}
        color={healthColors[healthStatus]}
      />
    </div>
  );
}
