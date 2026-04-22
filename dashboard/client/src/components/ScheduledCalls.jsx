import { useEffect, useState } from 'react';

const STATUS_STYLES = {
  scheduled:    { label: 'Scheduled',    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  demo_built:   { label: 'Demo ready',   color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  demo_failed:  { label: 'Build failed', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  completed:    { label: 'Completed',    color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
  cancelled:    { label: 'Cancelled',    color: 'bg-gray-500/20 text-gray-500 border-gray-500/30' },
  no_show:      { label: 'No show',      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
};

const OUTCOMES = [
  { key: '', label: '—' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'no_show', label: 'No-show' },
];

function formatDateTime(iso) {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const abs = Math.abs(diffMin);
  const future = diffMin >= 0;
  if (abs < 60) return future ? `in ${abs}m` : `${abs}m ago`;
  const hours = Math.round(abs / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return future ? `in ${days}d` : `${days}d ago`;
}

export default function ScheduledCalls({ ws }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buildingId, setBuildingId] = useState(null);

  async function fetchCalls() {
    try {
      const res = await fetch('/api/scheduled-calls');
      const data = await res.json();
      setCalls(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to fetch scheduled calls:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ws) return;
    const unsubs = [
      ws.on('demo_build_started', fetchCalls),
      ws.on('demo_build_completed', fetchCalls),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [ws]);

  async function buildDemo(call) {
    setBuildingId(call.id);
    try {
      const res = await fetch(`/api/scheduled-calls/${call.id}/build-demo`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Build failed');
      await fetchCalls();
    } catch (err) {
      alert(`Build failed: ${err.message}`);
    } finally {
      setBuildingId(null);
    }
  }

  async function patchCall(id, patch) {
    await fetch(`/api/scheduled-calls/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    fetchCalls();
  }

  if (loading) {
    return <div className="p-6 text-gray-400">Loading scheduled calls…</div>;
  }

  if (calls.length === 0) {
    return (
      <div className="p-10 text-center">
        <div className="text-4xl mb-3">📅</div>
        <div className="text-lg text-white mb-1">No calls scheduled yet</div>
        <div className="text-sm text-gray-400">
          When a prospect books via Calendly, they'll appear here and the demo site
          will be built automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold text-white">Scheduled Calls</h1>
        <div className="text-sm text-gray-400">{calls.length} upcoming</div>
      </div>

      <div className="space-y-3">
        {calls.map((call) => {
          const status = STATUS_STYLES[call.status] || STATUS_STYLES.scheduled;
          const hasDemo = !!call.preview_url;
          return (
            <div
              key={call.id}
              className="bg-dark-800 border border-dark-500 rounded-lg p-4 hover:border-dark-400 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-white font-semibold truncate">
                      {call.business_name || 'Unknown business'}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded border ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mb-2">
                    {call.category ? `${call.category} • ` : ''}
                    {call.address || 'Address unknown'}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-gray-300">
                      <span className="text-gray-500">When:</span>{' '}
                      {formatDateTime(call.scheduled_at)}{' '}
                      <span className="text-gray-500">({relativeTime(call.scheduled_at)})</span>
                    </div>
                    {call.booker_email && (
                      <div className="text-gray-400 truncate">
                        <span className="text-gray-500">Booked by:</span>{' '}
                        {call.booker_name || call.booker_email}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {hasDemo ? (
                    <a
                      href={call.preview_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition"
                    >
                      Open demo →
                    </a>
                  ) : (
                    <button
                      disabled={buildingId === call.id}
                      onClick={() => buildDemo(call)}
                      className="px-3 py-1.5 bg-dark-600 hover:bg-dark-500 disabled:opacity-50 text-white text-sm rounded transition"
                    >
                      {buildingId === call.id ? 'Building…' : 'Build demo'}
                    </button>
                  )}
                  {hasDemo && (
                    <button
                      disabled={buildingId === call.id}
                      onClick={() => buildDemo(call)}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      {buildingId === call.id ? 'Rebuilding…' : 'Rebuild'}
                    </button>
                  )}
                  <a
                    href={`/api/scheduled-calls/${call.id}/ics`}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    Add to calendar
                  </a>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-dark-700 flex flex-wrap gap-3 items-center">
                <label className="text-xs text-gray-500 flex items-center gap-2">
                  Outcome
                  <select
                    value={call.outcome || ''}
                    onChange={(e) => patchCall(call.id, { outcome: e.target.value })}
                    className="bg-dark-900 border border-dark-500 rounded px-2 py-1 text-xs text-white"
                  >
                    {OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </label>
                <input
                  defaultValue={call.notes || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (call.notes || '')) patchCall(call.id, { notes: e.target.value });
                  }}
                  placeholder="Notes (save on blur)…"
                  className="flex-1 min-w-[200px] bg-dark-900 border border-dark-500 rounded px-2 py-1 text-xs text-white placeholder-gray-500"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
