import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket.js';
import Dashboard from './components/Dashboard.jsx';
import Settings from './components/Settings.jsx';
import SiteGallery from './components/SiteGallery.jsx';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [keysStatus, setKeysStatus] = useState({ checks: {}, allValid: false });
  const ws = useWebSocket();

  useEffect(() => {
    const fetchStatus = () =>
      fetch('/api/settings/validate')
        .then((r) => r.json())
        .then(setKeysStatus)
        .catch(() => {});
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [page]);

  // Count keys present. 4/4 = LIVE, 1–3 = MIXED, 0 = MOCK.
  const keyCount = Object.values(keysStatus.checks || {}).filter(Boolean).length;
  const mode = keyCount === 4 ? 'LIVE' : keyCount === 0 ? 'MOCK' : 'MIXED';
  const modeTone = {
    LIVE: 'bg-green-500/20 text-green-400 border-green-500/40',
    MIXED: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    MOCK: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
  }[mode];

  const showSetupNudge = mode === 'MOCK' && page === 'dashboard';

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Top Nav */}
      <nav className="bg-dark-800 border-b border-dark-500 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            WEBSITE SCALER
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider border px-2 py-0.5 rounded font-semibold ${modeTone}`}
            title={
              mode === 'LIVE'
                ? 'All provider keys set. Real businesses, real Claude copy, real emails.'
                : mode === 'MIXED'
                ? `${keyCount}/4 keys set. Some agents will still use mock data.`
                : 'No keys set. Everything is mock data. Add keys in Settings.'
            }
          >
            {mode}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setPage('dashboard')}
            className={`px-3 py-1.5 rounded text-sm transition ${
              page === 'dashboard' ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setPage('sites')}
            className={`px-3 py-1.5 rounded text-sm transition ${
              page === 'sites' ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Sites
          </button>
          <button
            onClick={() => setPage('settings')}
            className={`px-3 py-1.5 rounded text-sm transition ${
              page === 'settings' ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Settings
            {mode !== 'LIVE' && (
              <span className="ml-1.5 text-[10px] bg-amber-500/30 text-amber-300 px-1 py-0.5 rounded">
                !
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 ml-4">
            <div
              className={`w-2 h-2 rounded-full ${
                ws.connected ? 'bg-green-500 animate-pulse-green' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-gray-400">
              {ws.connected ? 'WS' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </nav>

      {/* First-run nudge */}
      {showSetupNudge && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-amber-400 font-semibold">Setup needed —</span>{' '}
            <span className="text-amber-300/80">
              No API keys yet. You're seeing mock data. Add keys in Settings to run against real
              Google Maps + Claude + SendGrid.
            </span>
          </div>
          <button
            onClick={() => setPage('settings')}
            className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded font-medium transition"
          >
            Open Settings →
          </button>
        </div>
      )}

      {/* Main Content */}
      {page === 'dashboard' && <Dashboard ws={ws} />}
      {page === 'sites' && <SiteGallery />}
      {page === 'settings' && <Settings />}
    </div>
  );
}
