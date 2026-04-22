import { useState, useEffect } from 'react';

const AGENT_CONFIG = {
  Commander:       { emoji: '🧠', role: 'Orchestrator',      color: '#a78bfa', bgColor: '#1e1b4b', borderColor: '#4c1d95' },
  Scout:           { emoji: '🔍', role: 'Lead Discovery',    color: '#60a5fa', bgColor: '#172554', borderColor: '#1e40af' },
  Scraper:         { emoji: '🕷️', role: 'Data Enrichment',   color: '#34d399', bgColor: '#022c22', borderColor: '#065f46' },
  'Builder-Alpha': { emoji: '🏗️', role: 'Site Builder #1',   color: '#fbbf24', bgColor: '#422006', borderColor: '#92400e' },
  'Builder-Beta':  { emoji: '⚡', role: 'Site Builder #2',   color: '#fb923c', bgColor: '#431407', borderColor: '#9a3412' },
  'Builder-Gamma': { emoji: '🔨', role: 'Site Builder #3',   color: '#f87171', bgColor: '#450a0a', borderColor: '#991b1b' },
  Postman:         { emoji: '📧', role: 'Email Outreach',    color: '#f472b6', bgColor: '#500724', borderColor: '#9d174d' },
  Accountant:      { emoji: '💰', role: 'Token Tracking',    color: '#2dd4bf', bgColor: '#042f2e', borderColor: '#115e59' },
  Pricer:          { emoji: '🏷️', role: 'Dynamic Pricing',   color: '#facc15', bgColor: '#422006', borderColor: '#854d0e' },
  Sentinel:        { emoji: '🛡️', role: 'Security Guardian', color: '#818cf8', bgColor: '#1e1b4b', borderColor: '#3730a3' },
};

// The pipeline steps in order — this is the "family tree"
const PIPELINE_STEPS = [
  { key: 'Commander', label: 'ORCHESTRATE' },
  { key: 'Scout', label: 'FIND LEADS' },
  { key: 'Scraper', label: 'ENRICH DATA' },
  { key: 'builders', label: 'BUILD SITES' },
  { key: 'Postman', label: 'SEND EMAILS' },
];

function getThought(agent, tokens, pricingData) {
  const name = agent.agent_name || agent.name;
  const isOnline = agent.status === 'online';
  const tokenInfo = tokens?.byAgent?.find(t => t.agent_name === name);

  if (!isOnline) return { text: 'Offline... 😴', status: 'offline' };

  const thoughts = {
    Commander: ['Coordinating the squad... all systems nominal', 'Dispatching work to the builders', 'Monitoring pipeline throughput'],
    Scout: ['Scanning Google Maps for targets...', 'Hunting for businesses without websites 🎯', 'Found some leads! Passing to Scraper...'],
    Scraper: ['Pulling phone numbers, hours, reviews...', 'Enriching business data from Places API', 'Scraping details for the next batch 🕸️'],
    'Builder-Alpha': ['Generating a restaurant website with Claude...', 'Crafting premium HTML with custom design 🎨', 'Building mobile-first responsive sites...'],
    'Builder-Beta': ['Spinning up another site build...', 'Designing a salon website — looks gorgeous', 'Validating HTML output, checking sections...'],
    'Builder-Gamma': ['Third builder online and building fast ⚡', 'Parallel builds = more throughput!', 'Generating sites at full capacity...'],
    Postman: ['Drafting personalized outreach emails...', 'Sending "I built you a website" pitches 📬', 'Checking suppression list before sending...'],
    Accountant: [tokenInfo ? `Tracked ${tokenInfo.total?.toLocaleString() || 0} tokens today ($${(tokenInfo.cost || 0).toFixed(2)})` : 'Tracking token usage across all agents...', 'Watching API costs like a hawk 🦅', 'Budget looking good so far today!'],
    Pricer: [`Current price: $${pricingData?.currentPrice || 150}/site`, `Guaranteed $150+ profit per site 💪`, 'Tracking every token... adjusting price automatically 🏷️'],
    Sentinel: ['All agents reporting in — heartbeats normal', 'Monitoring system health and uptime 🛡️', `${agent.restart_count || 0} restarts today — keeping things stable`],
  };

  const options = thoughts[name] || ['Working hard...'];
  const idx = Math.floor(Date.now() / 8000) % options.length;
  return { text: options[idx], status: 'online' };
}

function AgentCard({ agent, tokens, pricingData, size = 'normal' }) {
  const name = agent.agent_name || agent.name;
  const config = AGENT_CONFIG[name] || { emoji: '🤖', role: 'Agent', color: '#9ca3af', bgColor: '#1f2937', borderColor: '#374151' };
  const thought = getThought(agent, tokens, pricingData);
  const isOnline = agent.status === 'online';
  const isSmall = size === 'small';

  return (
    <div className="flex flex-col items-center">
      {/* Speech bubble */}
      <div
        className={`relative rounded-2xl px-3 py-2 mb-3 text-center ${isSmall ? 'max-w-[160px]' : 'max-w-[200px]'}`}
        style={{ backgroundColor: config.bgColor, border: `1.5px solid ${config.borderColor}` }}
      >
        <p className="text-xs leading-relaxed" style={{ color: config.color }}>{thought.text}</p>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0" style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: `8px solid ${config.borderColor}` }} />
        <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-0 h-0" style={{ borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `7px solid ${config.bgColor}` }} />
      </div>

      {/* Agent emoji circle */}
      <div
        className={`relative rounded-full flex items-center justify-center shadow-lg transition-transform ${isSmall ? 'w-12 h-12 text-2xl' : 'w-16 h-16 text-3xl'} ${isOnline ? '' : 'opacity-50'}`}
        style={{ backgroundColor: config.bgColor, border: `3px solid ${config.borderColor}`, boxShadow: isOnline ? `0 0 15px ${config.borderColor}40` : 'none' }}
      >
        {config.emoji}
        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-dark-900 flex items-center justify-center text-[8px] ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}>
          {isOnline ? '⚡' : '💤'}
        </div>
      </div>

      {/* Label */}
      <div className="mt-2 text-center">
        <div className={`font-semibold ${isSmall ? 'text-xs' : 'text-sm'}`} style={{ color: config.color }}>{name}</div>
        <div className="text-[10px] text-gray-500">{config.role}</div>
      </div>
    </div>
  );
}

function ConnectorLine({ label, vertical = true }) {
  if (vertical) {
    return (
      <div className="flex flex-col items-center py-1">
        <div className="w-0.5 h-5 bg-gradient-to-b from-gray-600 to-gray-700" />
        <div className="px-3 py-1 rounded-full bg-dark-700 border border-dark-500">
          <span className="text-[10px] font-bold tracking-wider text-gray-400">{label}</span>
        </div>
        <div className="w-0.5 h-5 bg-gradient-to-b from-gray-700 to-gray-600" />
      </div>
    );
  }
  return (
    <div className="flex items-center">
      <div className="h-0.5 w-6 bg-gradient-to-r from-gray-600 to-gray-700" />
      <div className="text-[10px] text-gray-500 px-1">→</div>
      <div className="h-0.5 w-6 bg-gradient-to-r from-gray-700 to-gray-600" />
    </div>
  );
}

export default function Agents({ ws }) {
  const [agents, setAgents] = useState([]);
  const [tokens, setTokens] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(setAgents).catch(() => {});
    fetch('/api/tokens').then(r => r.json()).then(setTokens).catch(() => {});
    fetch('/api/activity?limit=30').then(r => r.json()).then(setLogs).catch(() => {});
    fetch('/api/pricing').then(r => r.json()).then(setPricing).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ws) return;
    const handleHeartbeat = (data) => {
      if (data.agents) {
        setAgents(data.agents.map(a => ({ agent_name: a.name, status: a.status, restart_count: a.restartCount })));
      }
    };
    const handleActivity = (data) => {
      setLogs(prev => [data, ...prev].slice(0, 30));
    };
    const unsubHeartbeat = ws.on('heartbeat_grid', handleHeartbeat);
    const unsubActivity = ws.on('activity', handleActivity);
    return () => {
      if (unsubHeartbeat) unsubHeartbeat();
      if (unsubActivity) unsubActivity();
    };
  }, [ws]);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 8000);
    return () => clearInterval(interval);
  }, []);

  const findAgent = (name) => agents.find(a => (a.agent_name || a.name) === name);
  const onlineCount = agents.filter(a => a.status === 'online').length;
  const commander = findAgent('Commander');
  const scout = findAgent('Scout');
  const scraper = findAgent('Scraper');
  const builders = agents.filter(a => (a.agent_name || a.name)?.startsWith('Builder'));
  const postman = findAgent('Postman');
  const pricer = findAgent('Pricer');
  const accountant = findAgent('Accountant');
  const sentinel = findAgent('Sentinel');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Agent Squad</h1>
        <p className="text-sm text-gray-400 mt-1">
          <span className={onlineCount > 0 ? 'text-green-400' : 'text-red-400'}>
            {onlineCount}/{agents.length} online
          </span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-500">Pipeline flow: Find → Scrape → Build → Email → 💰</span>
        </p>
      </div>

      {/* ═══ FAMILY TREE ═══ */}
      <div className="flex flex-col items-center">

        {/* Step 1: Commander */}
        {commander && <AgentCard agent={commander} tokens={tokens} pricingData={pricing} />}
        <ConnectorLine label="DISPATCHES WORK" />

        {/* Step 2: Scout */}
        {scout && <AgentCard agent={scout} tokens={tokens} pricingData={pricing} />}
        <ConnectorLine label="LEADS FOUND → ENRICH" />

        {/* Step 3: Scraper */}
        {scraper && <AgentCard agent={scraper} tokens={tokens} pricingData={pricing} />}
        <ConnectorLine label="DATA READY → BUILD SITES" />

        {/* Step 4: Builder trio (fan out) */}
        <div className="relative w-full flex flex-col items-center">
          {/* Lines fanning from center to each builder */}
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {builders.length === 3 && (
              <>
                {/* Left line */}
                <line x1="50%" y1="0" x2="20%" y2="30" stroke="#374151" strokeWidth="2" strokeDasharray="4 4" />
                {/* Center line */}
                <line x1="50%" y1="0" x2="50%" y2="30" stroke="#374151" strokeWidth="2" strokeDasharray="4 4" />
                {/* Right line */}
                <line x1="50%" y1="0" x2="80%" y2="30" stroke="#374151" strokeWidth="2" strokeDasharray="4 4" />
              </>
            )}
          </svg>

          <div className="px-3 py-1 rounded-full bg-dark-700 border border-dark-500 mb-4 z-10">
            <span className="text-[10px] font-bold tracking-wider text-yellow-400">⚡ PARALLEL BUILD (3x)</span>
          </div>

          <div className="flex justify-center gap-8 relative z-10">
            {builders.map(agent => (
              <AgentCard key={agent.agent_name || agent.name} agent={agent} tokens={tokens} pricingData={pricing} size="small" />
            ))}
          </div>
        </div>

        <ConnectorLine label="SITES READY → SEND EMAILS" />

        {/* Step 5: Postman */}
        {postman && <AgentCard agent={postman} tokens={tokens} pricingData={pricing} />}

        <ConnectorLine label="CALCULATE PRICE" />

        {/* Step 6: Pricer */}
        {pricer && <AgentCard agent={pricer} tokens={tokens} pricingData={pricing} />}

        {/* Dynamic price outcome */}
        <div className="flex flex-col items-center py-2">
          <div className="w-0.5 h-5 bg-gradient-to-b from-gray-600 to-green-600" />
          <div className="px-4 py-3 rounded-xl bg-green-900/30 border border-green-700/50 mt-1 text-center">
            <span className="text-lg font-bold text-green-400">💰 ${pricing?.currentPrice || 50}/site</span>
            {pricing?.avgCostPerBusiness > 0 && (
              <div className="text-[10px] text-green-500/70 mt-1">
                cost ${pricing.avgCostPerBusiness.toFixed(4)} × 5x margin = profit
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PRICING BREAKDOWN ═══ */}
      {pricing && (
        <div className="card mt-8">
          <div className="card-header mb-3">🏷️ Dynamic Pricing Engine</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-dark-800 rounded-lg p-3 border border-dark-500">
              <div className="text-[10px] text-gray-500">Current Price</div>
              <div className="text-xl font-bold text-green-400">${pricing.currentPrice}</div>
            </div>
            <div className="bg-dark-800 rounded-lg p-3 border border-dark-500">
              <div className="text-[10px] text-gray-500">Avg Cost/Biz</div>
              <div className="text-xl font-bold text-yellow-400">${pricing.avgCostPerBusiness?.toFixed(4) || '0.00'}</div>
            </div>
            <div className="bg-dark-800 rounded-lg p-3 border border-dark-500">
              <div className="text-[10px] text-gray-500">Net Profit</div>
              <div className="text-xl font-bold text-emerald-400">${pricing.netProfit?.toFixed(2) || '0.00'}</div>
            </div>
            <div className="bg-dark-800 rounded-lg p-3 border border-dark-500">
              <div className="text-[10px] text-gray-500">Sample Size</div>
              <div className="text-xl font-bold text-blue-400">{pricing.sampleSize || 0}</div>
            </div>
          </div>

          {/* Cost breakdown by step */}
          {pricing.byStep && pricing.byStep.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-gray-400 mb-2 font-semibold">Cost Breakdown by Step</div>
              <div className="space-y-1">
                {pricing.byStep.map(step => (
                  <div key={step.step} className="flex items-center justify-between text-xs bg-dark-800 rounded px-3 py-2">
                    <span className="text-gray-300 capitalize">{step.step}</span>
                    <div className="flex gap-4">
                      <span className="text-gray-500">{Math.round(step.avg_tokens)} avg tokens</span>
                      <span className="text-yellow-400">${step.avg_cost?.toFixed(5)}/biz</span>
                      <span className="text-gray-400">${step.total_cost?.toFixed(4)} total</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price history */}
          {pricing.priceHistory && pricing.priceHistory.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-2 font-semibold">Price Change History</div>
              <div className="space-y-1 max-h-[100px] overflow-y-auto">
                {pricing.priceHistory.map((entry, i) => (
                  <div key={i} className="text-xs text-gray-400 flex gap-2">
                    <span className="font-mono text-gray-500">{new Date(entry.created_at).toLocaleString()}</span>
                    <span>{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SUPPORT AGENTS (off to the side) ═══ */}
      <div className="mt-8 flex justify-center gap-6">
        <div className="flex flex-col items-center">
          <div className="text-[10px] text-gray-500 mb-3 font-bold tracking-wider">SUPPORT AGENTS</div>
          <div className="flex gap-8">
            {accountant && <AgentCard agent={accountant} tokens={tokens} pricingData={pricing} size="small" />}
            {sentinel && <AgentCard agent={sentinel} tokens={tokens} pricingData={pricing} size="small" />}
          </div>
          {/* Dashed line connecting to main pipeline */}
          <div className="flex items-center gap-2 mt-3">
            <div className="h-0.5 w-12 border-t border-dashed border-gray-600" />
            <span className="text-[10px] text-gray-600">monitors all agents above</span>
            <div className="h-0.5 w-12 border-t border-dashed border-gray-600" />
          </div>
        </div>
      </div>

      {/* ═══ LIVE ACTIVITY FEED ═══ */}
      <div className="card mt-10">
        <div className="card-header mb-3">Live Agent Activity</div>
        <div className="max-h-[250px] overflow-y-auto space-y-1.5">
          {logs.length === 0 ? (
            <div className="text-xs text-gray-600">No activity yet...</div>
          ) : (
            logs.map((log, i) => {
              const name = log.agent_name || 'System';
              const config = AGENT_CONFIG[name];
              return (
                <div key={log.id || i} className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0">{config?.emoji || '📋'}</span>
                  <span className="font-mono text-gray-500 flex-shrink-0">
                    {log.created_at ? new Date(log.created_at).toLocaleTimeString() : ''}
                  </span>
                  <span className="font-semibold flex-shrink-0" style={{ color: config?.color || '#9ca3af' }}>{name}</span>
                  <span className="text-gray-400 truncate">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══ FLOW SUMMARY ═══ */}
      <div className="card mt-6">
        <div className="card-header mb-3">The Pipeline</div>
        <div className="flex items-center justify-between gap-1 text-sm py-2 overflow-x-auto">
          <Step emoji="🔍" label="Find" desc="Google Maps" color="#60a5fa" />
          <Arrow />
          <Step emoji="🕷️" label="Scrape" desc="Enrich data" color="#34d399" />
          <Arrow />
          <Step emoji="🏗️" label="Build" desc="AI websites" color="#fbbf24" />
          <Arrow />
          <Step emoji="📧" label="Email" desc="Cold outreach" color="#f472b6" />
          <Arrow />
          <Step emoji="💰" label="Sell" desc="$50/site" color="#4ade80" />
        </div>
      </div>
    </div>
  );
}

function Step({ emoji, label, desc, color }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[70px]">
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-bold" style={{ color }}>{label}</span>
      <span className="text-[10px] text-gray-500">{desc}</span>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center px-1">
      <div className="h-0.5 w-4 bg-gray-600" />
      <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-gray-600" />
    </div>
  );
}
