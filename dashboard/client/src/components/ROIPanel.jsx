import { useEffect, useState } from 'react';

// Profit = sales revenue minus API spend. Polls /api/cost/roi every 10s.
export default function ROIPanel() {
  const [data, setData] = useState({ days: [], totals: { spend: 0, revenue: 0, profit: 0 } });

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/cost/roi')
        .then((r) => r.json())
        .then((d) => alive && setData(d))
        .catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const { totals, days } = data;
  const profitTone =
    totals.profit > 0 ? 'text-green-400' : totals.profit < 0 ? 'text-red-400' : 'text-gray-300';
  const maxBar = Math.max(
    1,
    ...days.map((d) => Math.max(d.revenue || 0, d.spend || 0)),
  );

  return (
    <div className="card border border-dark-500 p-4 rounded-lg bg-dark-800/40">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
          Profit
        </h3>
        <div className={`font-mono text-2xl font-bold ${profitTone}`}>
          {totals.profit >= 0 ? '+' : ''}${totals.profit.toFixed(2)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-dark-900 p-2 rounded">
          <div className="text-gray-500">Revenue</div>
          <div className="text-green-400 font-mono">${totals.revenue.toFixed(2)}</div>
        </div>
        <div className="bg-dark-900 p-2 rounded">
          <div className="text-gray-500">Spend</div>
          <div className="text-red-400 font-mono">${totals.spend.toFixed(2)}</div>
        </div>
      </div>

      {/* Sparkline — last 14 days, revenue (green) vs spend (red) */}
      {days.length > 0 && (
        <div className="space-y-1">
          {days.slice(0, 7).map((d) => (
            <div key={d.day} className="flex items-center gap-2 text-[10px]">
              <div className="w-14 text-gray-500 font-mono">{d.day.slice(5)}</div>
              <div className="flex-1 flex gap-1 h-3">
                <div
                  className="bg-green-500/60"
                  style={{ width: `${((d.revenue || 0) / maxBar) * 50}%` }}
                  title={`Revenue: $${d.revenue.toFixed(2)}`}
                />
                <div
                  className="bg-red-500/60"
                  style={{ width: `${((d.spend || 0) / maxBar) * 50}%` }}
                  title={`Spend: $${d.spend.toFixed(2)}`}
                />
              </div>
              <div
                className={`w-14 text-right font-mono ${
                  d.profit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {d.profit >= 0 ? '+' : ''}${d.profit.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {days.length === 0 && (
        <p className="text-xs text-gray-500 italic">No activity yet. Deploy a pipeline to see profit.</p>
      )}
    </div>
  );
}
