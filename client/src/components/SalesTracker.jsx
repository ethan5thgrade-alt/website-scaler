import { useState } from 'react';

export default function SalesTracker({ sales, onSimulate }) {
  const [animatingId, setAnimatingId] = useState(null);

  async function simulateSale() {
    try {
      await fetch('/api/sales/simulate', { method: 'POST' });
      onSimulate();
    } catch (err) {
      console.error('Simulate failed:', err);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="card-header mb-0">Sales Tracker</div>
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold text-green-400">
            ${sales.totalRevenue?.toLocaleString() || '0'}
          </div>
          <button
            onClick={simulateSale}
            className="text-xs px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded transition"
          >
            + Simulate Sale
          </button>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[300px] space-y-2">
        {(!sales.sales || sales.sales.length === 0) ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No sales yet. Deploy a pipeline and start closing!
          </div>
        ) : (
          sales.sales.map((sale) => (
            <div
              key={sale.id}
              className={`flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20
                ${animatingId === sale.id ? 'animate-ka-ching' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm">
                  $
                </div>
                <div>
                  <div className="font-medium text-white text-sm">{sale.business_name}</div>
                  <div className="text-xs text-gray-400">
                    {sale.location} &middot; {sale.builder_agent}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-400">${sale.amount}</div>
                <div className="text-xs text-gray-500">
                  {new Date(sale.claimed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
