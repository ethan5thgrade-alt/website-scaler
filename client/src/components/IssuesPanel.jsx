import { useState } from 'react';

const SEVERITY_STYLES = {
  error: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', badge: 'badge-error' },
  warning: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', badge: 'badge-warning' },
  info: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', badge: 'badge-info' },
};

export default function IssuesPanel({ issues, onRetry }) {
  const [tab, setTab] = useState('active');

  async function handleRetry(issueId) {
    try {
      await fetch(`/api/issues/${issueId}/retry`, { method: 'POST' });
      onRetry();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  }

  const items = tab === 'active' ? issues.active : issues.resolved;

  return (
    <div className="card h-[420px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="card-header mb-0">Issues</div>
        <div className="flex gap-1">
          <button
            onClick={() => setTab('active')}
            className={`px-2 py-1 text-xs rounded transition ${
              tab === 'active' ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Active ({issues.active?.length || 0})
          </button>
          <button
            onClick={() => setTab('resolved')}
            className={`px-2 py-1 text-xs rounded transition ${
              tab === 'resolved' ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Resolved ({issues.resolved?.length || 0})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {(!items || items.length === 0) ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {tab === 'active' ? 'No active issues' : 'No resolved issues'}
          </div>
        ) : (
          items.map((issue) => {
            const style = SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.warning;
            return (
              <div
                key={issue.id}
                className={`p-3 rounded-lg border ${style.bg}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${style.badge}`}>{issue.severity?.toUpperCase()}</span>
                    <span className="text-xs text-gray-400">{issue.agent_name}</span>
                  </div>
                  {tab === 'active' && (
                    <button
                      onClick={() => handleRetry(issue.id)}
                      className="text-xs px-2 py-1 bg-dark-600 hover:bg-dark-500 rounded text-gray-300 transition"
                    >
                      Retry
                    </button>
                  )}
                </div>
                <div className={`text-sm ${style.text}`}>{issue.description}</div>
                {issue.suggested_fix && (
                  <div className="text-xs text-gray-500 mt-1">Fix: {issue.suggested_fix}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
