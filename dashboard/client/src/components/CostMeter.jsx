import { useEffect, useState } from 'react';

// Live budget meter. Two-source: polls /api/cost/today every 5s AND listens
// for `cost_tick` + `budget_tick` WebSocket events for instant updates
// whenever an agent spends.
export default function CostMeter({ ws }) {
  const [state, setState] = useState({
    today_cents: 0,
    cap_cents: 500,
    breakdown: [],
    over_budget: false,
  });

  useEffect(() => {
    let alive = true;
    const fetchCost = () =>
      fetch('/api/cost/today')
        .then((r) => r.json())
        .then((d) => alive && setState(d))
        .catch(() => {});
    fetchCost();
    const interval = setInterval(fetchCost, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!ws) return;
    const unsubs = [
      ws.on('cost_tick', (d) => {
        setState((prev) => ({
          ...prev,
          today_cents: d.today_cents ?? prev.today_cents,
          cap_cents: d.daily_cap_cents ?? prev.cap_cents,
        }));
      }),
      ws.on('budget_tick', (d) => {
        setState((prev) => ({
          ...prev,
          today_cents: d.today_cents ?? prev.today_cents,
          cap_cents: d.cap_cents ?? prev.cap_cents,
          breakdown: d.breakdown ?? prev.breakdown,
        }));
      }),
      ws.on('budget_exceeded', () =>
        setState((prev) => ({ ...prev, over_budget: true })),
      ),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [ws]);

  const today = state.today_cents / 100;
  const cap = state.cap_cents / 100;
  const pct = cap > 0 ? Math.min(100, (today / cap) * 100) : 0;
  const tone = pct >= 95 ? 'red' : pct >= 80 ? 'amber' : 'green';
  const barColor = {
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }[tone];
  const textColor = {
    green: 'text-green-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  }[tone];

  return (
    <div className="card border border-dark-500 p-4 rounded-lg bg-dark-800/40 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
            Spend today
          </h3>
          <div className={`text-2xl font-mono font-bold mt-1 ${textColor}`}>
            ${today.toFixed(2)}
            <span className="text-gray-500 text-sm ml-1">/ ${cap.toFixed(2)}</span>
          </div>
        </div>
        {state.over_budget && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/20 text-red-400 uppercase tracking-wider font-medium">
            Budget hit
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-dark-900 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Breakdown by agent */}
      {state.breakdown && state.breakdown.length > 0 && (
        <div className="pt-2 space-y-1 border-t border-dark-600">
          {state.breakdown.map((row) => (
            <div
              key={row.agent}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-gray-400">{row.agent}</span>
              <span className="font-mono text-gray-300">
                ${(row.cents / 100).toFixed(3)}
                {row.calls > 0 && (
                  <span className="text-gray-500 ml-2">· {row.calls} calls</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
