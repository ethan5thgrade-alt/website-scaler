import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket.js';
import Dashboard from './components/Dashboard.jsx';
import Agents from './components/Agents.jsx';
import Leads from './components/Leads.jsx';
import ScheduledCalls from './components/ScheduledCalls.jsx';
import Settings from './components/Settings.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const PAGE_TITLES = {
  dashboard: 'Dashboard · Website Scaler',
  agents: 'Agents · Website Scaler',
  leads: 'Leads · Website Scaler',
  calls: 'Scheduled Calls · Website Scaler',
  settings: 'Settings · Website Scaler',
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const ws = useWebSocket();

  useEffect(() => {
    document.title = PAGE_TITLES[page] || 'Website Scaler';
  }, [page]);

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Top Nav */}
      <nav className="bg-dark-800 border-b border-dark-500 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            WEBSITE SCALER
          </div>
          <span className="text-xs text-gray-500 border border-dark-500 px-2 py-0.5 rounded">
            COMMAND CENTER
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
            onClick={() => setPage('agents')}
            className={`px-3 py-1.5 rounded text-sm transition ${
              page === 'agents' ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            🤖 Agents
          </button>
          <button
            onClick={() => setPage('leads')}
            className={`px-3 py-1.5 rounded text-sm transition ${
              page === 'leads' ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            🗂 Leads
          </button>
          <button
            onClick={() => setPage('calls')}
            className={`px-3 py-1.5 rounded text-sm transition ${
              page === 'calls' ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            📅 Calls
          </button>
          <button
            onClick={() => setPage('settings')}
            className={`px-3 py-1.5 rounded text-sm transition ${
              page === 'settings' ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Settings
          </button>

          <div className="flex items-center gap-2 ml-4">
            <div className={`w-2 h-2 rounded-full ${ws.connected ? 'bg-green-500 animate-pulse-green' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">
              {ws.connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <ErrorBoundary key={page}>
        {page === 'dashboard' && <Dashboard ws={ws} />}
        {page === 'agents' && <Agents ws={ws} />}
        {page === 'leads' && <Leads />}
        {page === 'calls' && <ScheduledCalls ws={ws} />}
        {page === 'settings' && <Settings />}
      </ErrorBoundary>
    </div>
  );
}
