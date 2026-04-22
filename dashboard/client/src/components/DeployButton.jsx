import { useState } from 'react';

export default function DeployButton({ running, onStatusChange }) {
  const [deploying, setDeploying] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [preflight, setPreflight] = useState(null);
  const [config, setConfig] = useState({
    zipCodes: '90210, 90211, 90212',
    categories: 'restaurant, salon, dentist, gym',
    maxLeads: 20,
    dailyEmailLimit: 50,
    skipPreflight: false,
  });

  async function runPreflight() {
    const r = await fetch('/api/settings/preflight', { method: 'POST' });
    const j = await r.json();
    setPreflight(j);
    return j;
  }

  async function handleDeploy() {
    setDeploying(true);
    try {
      // Pre-flight: verify keys before spending real money. User can skip
      // for mock runs via the config panel.
      if (!config.skipPreflight) {
        const pf = await runPreflight();
        // If ANY provider has a key set but fails, abort. If providers are
        // simply missing (no key), allow — that's intentional mock mode.
        const hardFails = pf.results.filter(
          (r) => !r.ok && !/No key set/i.test(r.detail),
        );
        if (hardFails.length > 0) {
          setDeploying(false);
          return;
        }
      }

      const body = {
        zipCodes: config.zipCodes.split(',').map((s) => s.trim()).filter(Boolean),
        categories: config.categories.split(',').map((s) => s.trim()).filter(Boolean),
        maxLeads: parseInt(config.maxLeads) || 20,
        dailyEmailLimit: parseInt(config.dailyEmailLimit) || 50,
      };
      await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onStatusChange();
    } catch (err) {
      console.error('Deploy failed:', err);
    } finally {
      setDeploying(false);
    }
  }

  async function handleStop() {
    try {
      await fetch('/api/stop', { method: 'POST' });
      onStatusChange();
    } catch (err) {
      console.error('Stop failed:', err);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-4 flex-wrap">
        {!running ? (
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="relative px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-lg
                       hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/25
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deploying ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                PRE-FLIGHT CHECK...
              </span>
            ) : (
              'DEPLOY PIPELINE'
            )}
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 px-6 py-3 bg-green-500/20 border border-green-500/40 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="font-bold text-green-400 text-lg">RUNNING</span>
            </div>
            <button
              onClick={handleStop}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition"
            >
              STOP ALL
            </button>
          </>
        )}

        <button
          onClick={() => setShowConfig(!showConfig)}
          className="px-4 py-3 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg transition text-sm"
        >
          {showConfig ? 'Hide Config' : 'Configure'}
        </button>
      </div>

      {/* Pre-flight results — only shown when there's a hard failure. Passes +
          "no key set" entries stay quiet so the UI doesn't flood in mock mode. */}
      {preflight && preflight.results.some((r) => !r.ok && !/No key set/i.test(r.detail)) && (
        <div className="mt-4 p-3 rounded border border-red-500/30 bg-red-500/10 text-sm space-y-1">
          <div className="font-semibold text-red-400">Pre-flight failed — fix these before deploying:</div>
          {preflight.results
            .filter((r) => !r.ok && !/No key set/i.test(r.detail))
            .map((r) => (
              <div key={r.provider} className="text-red-300/80 font-mono text-xs">
                <span className="uppercase text-red-300">{r.provider}</span>: {r.detail}
              </div>
            ))}
          <button
            onClick={() => setConfig({ ...config, skipPreflight: true })}
            className="text-xs text-amber-400 hover:text-amber-300 underline mt-2"
          >
            Skip pre-flight and deploy anyway
          </button>
        </div>
      )}

      {showConfig && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-dark-500">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Zip Codes (comma separated)</label>
            <input
              type="text"
              value={config.zipCodes}
              onChange={(e) => setConfig({ ...config, zipCodes: e.target.value })}
              className="w-full bg-dark-800 border border-dark-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Business Categories</label>
            <input
              type="text"
              value={config.categories}
              onChange={(e) => setConfig({ ...config, categories: e.target.value })}
              className="w-full bg-dark-800 border border-dark-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Max Leads</label>
            <input
              type="number"
              value={config.maxLeads}
              onChange={(e) => setConfig({ ...config, maxLeads: e.target.value })}
              className="w-full bg-dark-800 border border-dark-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Daily Email Limit</label>
            <input
              type="number"
              value={config.dailyEmailLimit}
              onChange={(e) => setConfig({ ...config, dailyEmailLimit: e.target.value })}
              className="w-full bg-dark-800 border border-dark-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
