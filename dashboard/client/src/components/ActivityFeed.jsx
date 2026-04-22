import { useRef, useEffect } from 'react';

const STATUS_COLORS = {
  success: 'text-green-400',
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
};

const STATUS_BG = {
  success: 'bg-green-500/10',
  info: 'bg-blue-500/10',
  warning: 'bg-yellow-500/10',
  error: 'bg-red-500/10',
};

const STATUS_DOT = {
  success: 'bg-green-500',
  info: 'bg-blue-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
};

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
}

export default function ActivityFeed({ activity }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activity.length]);

  return (
    <div className="card h-[420px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="card-header mb-0">Live Activity Feed</div>
        <span className="text-xs text-gray-500">{activity.length} entries</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 pr-1">
        {activity.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No activity yet. Deploy a pipeline to start.
          </div>
        ) : (
          activity.map((entry, i) => {
            const status = entry.status || 'info';
            return (
              <div
                key={entry.id || i}
                className={`flex items-start gap-3 px-3 py-2 rounded-lg ${STATUS_BG[status]} animate-slide-in`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[status]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 font-mono">{formatTime(entry.created_at || entry.timestamp)}</span>
                    <span className="font-semibold text-gray-300">{entry.agent_name || entry.agent}</span>
                  </div>
                  <div className={`text-sm ${STATUS_COLORS[status]} truncate`}>
                    {entry.message || entry.action}
                  </div>
                </div>
                <span className={`badge ${status === 'success' ? 'badge-success' : status === 'error' ? 'badge-error' : status === 'warning' ? 'badge-warning' : 'badge-info'} flex-shrink-0`}>
                  {status.toUpperCase()}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
