import { useState, useEffect } from 'react';

function formatUptime(ms) {
  if (!ms) return '0h 0m 0s';
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function HeartbeatDot({ agent }) {
  const isOnline = agent.status === 'online';
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-5 h-5 rounded-full transition-all ${
          isOnline
            ? 'bg-green-500 animate-pulse-green shadow-lg shadow-green-500/30'
            : 'bg-red-500 animate-pulse-red shadow-lg shadow-red-500/30'
        }`}
        title={`${agent.name} — ${isOnline ? 'Online' : 'Offline'}`}
      />
      <span className="text-[10px] text-gray-500 text-center leading-tight max-w-[60px] truncate">
        {agent.name}
      </span>
    </div>
  );
}

export default function SecurityPanel({ agents, heartbeats }) {
  const [uptime, setUptime] = useState(heartbeats.sentinelUptime || 0);
  const [uptimeLogs, setUptimeLogs] = useState({ logs: [], restarts: [], agents: [] });

  useEffect(() => {
    fetch('/api/uptime').then((r) => r.json()).then(setUptimeLogs).catch(() => {});
  }, []);

  // Tick uptime every second
  useEffect(() => {
    setUptime(heartbeats.sentinelUptime || 0);
  }, [heartbeats.sentinelUptime]);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const agentList = heartbeats.agents?.length > 0
    ? heartbeats.agents
    : agents.map((a) => ({ name: a.agent_name, status: a.status, restartCount: a.restart_count }));

  return (
    <div className="card">
      <div className="card-header mb-4">Security &amp; Uptime — Sentinel</div>

      {/* Uptime Clock */}
      <div className="flex items-center gap-4 mb-5">
        <div className="px-4 py-2 bg-dark-800 rounded-lg border border-dark-500">
          <div className="text-xs text-gray-500 mb-1">System Uptime</div>
          <div className="text-xl font-mono font-bold text-green-400">{formatUptime(uptime)}</div>
        </div>
        <div className="px-4 py-2 bg-dark-800 rounded-lg border border-dark-500">
          <div className="text-xs text-gray-500 mb-1">Restarts Today</div>
          <div className="text-xl font-mono font-bold text-yellow-400">
            {uptimeLogs.restarts?.length || 0}
          </div>
        </div>
      </div>

      {/* Heartbeat Grid */}
      <div className="mb-5">
        <div className="text-xs text-gray-400 mb-2 font-semibold">Agent Heartbeat Grid</div>
        <div className="flex flex-wrap gap-3">
          {agentList.map((agent) => (
            <HeartbeatDot key={agent.name || agent.agent_name} agent={agent} />
          ))}
        </div>
      </div>

      {/* Restart History */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2 font-semibold">Recent Restart History</div>
        <div className="max-h-[100px] overflow-y-auto space-y-1">
          {(!uptimeLogs.restarts || uptimeLogs.restarts.length === 0) ? (
            <div className="text-xs text-gray-600">No restarts recorded</div>
          ) : (
            uptimeLogs.restarts.slice(0, 5).map((r, i) => (
              <div key={i} className="text-xs flex items-center gap-2 text-gray-400">
                <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                <span className="font-mono">{new Date(r.created_at).toLocaleTimeString()}</span>
                <span>{r.agent_name}</span>
                <span className="text-gray-600">—</span>
                <span className="text-gray-500 truncate">{r.details}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* API Key Health */}
      <div>
        <div className="text-xs text-gray-400 mb-2 font-semibold">API Key Health</div>
        <div className="grid grid-cols-3 gap-2">
          {['Google Maps', 'LLM Provider', 'SendGrid'].map((name) => {
            const configured = false; // Will be updated from settings
            return (
              <div
                key={name}
                className={`text-xs px-2 py-1.5 rounded text-center border ${
                  configured
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                }`}
              >
                {name}: {configured ? 'OK' : 'MOCK'}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
