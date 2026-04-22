import { useState, useEffect } from 'react';

// Structured provider config. Adding a new provider = adding an entry here;
// everything else (UI, test button, save, status pill) wires up automatically.
const PROVIDERS = [
  {
    id: 'google_maps',
    title: 'Google Maps (Places API)',
    summary: 'Finds real businesses and pulls their hours, phone, photos, reviews.',
    signupUrl: 'https://console.cloud.google.com/google/maps-apis/credentials',
    helper:
      'Enable "Places API" and "Maps Embed API" in Google Cloud Console. Set a billing budget alert to be safe.',
    costLine: '$200/mo free credit. ~$0.05 per business (Text Search + Details + 3 photos).',
    keys: [
      { key: 'google_maps_api_key', label: 'API Key', type: 'password', placeholder: 'AIza...' },
    ],
  },
  {
    id: 'anthropic',
    title: 'Anthropic (Claude — copy & design)',
    summary: 'Writes the about text and tagline for each generated site. Haiku 4.5 keeps cost tiny.',
    signupUrl: 'https://console.anthropic.com/settings/keys',
    helper: '$5 free on signup. Runs ~$0.001 per site — you can do 5,000 sites for $5.',
    costLine: 'Haiku 4.5 — $1/M input, $5/M output.',
    keys: [
      { key: 'anthropic_api_key', label: 'API Key', type: 'password', placeholder: 'sk-ant-...' },
    ],
  },
  {
    id: 'sendgrid',
    title: 'SendGrid (outreach email)',
    summary: 'Sends the $50 pitch email with open + click tracking.',
    signupUrl: 'https://app.sendgrid.com/settings/api_keys',
    helper:
      'Free tier: 100 emails/day. Verify your sending domain under Sender Authentication and set up SPF + DKIM before hitting volume — otherwise everything lands in spam.',
    costLine: 'First 100/day free. ~$0.00085 per email after that.',
    keys: [
      { key: 'sendgrid_api_key', label: 'API Key', type: 'password', placeholder: 'SG...' },
      { key: 'sendgrid_from_email', label: 'From Address', type: 'email', placeholder: 'you@yourdomain.com' },
    ],
  },
];

const LIMITS_FIELDS = [
  {
    key: 'daily_budget_usd',
    label: 'Daily budget ($USD)',
    type: 'number',
    help: 'Hard stop — the pipeline auto-pauses when today\'s spend hits this.',
  },
  {
    key: 'daily_email_limit',
    label: 'Max emails / day',
    type: 'number',
    help: 'Stay under SendGrid deliverability limits.',
  },
  {
    key: 'max_emails_per_hour',
    label: 'Max emails / hour',
    type: 'number',
    help: 'Throttle so it doesn\'t look like a burst.',
  },
];

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState({}); // { providerId: 'pending' | 'ok' | 'fail' }
  const [testDetail, setTestDetail] = useState({});

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error);
  }

  function handleChange(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function testKey(providerId) {
    setTesting((prev) => ({ ...prev, [providerId]: 'pending' }));
    setTestDetail((prev) => ({ ...prev, [providerId]: '' }));
    try {
      const r = await fetch('/api/settings/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });
      const { ok, detail } = await r.json();
      setTesting((prev) => ({ ...prev, [providerId]: ok ? 'ok' : 'fail' }));
      setTestDetail((prev) => ({ ...prev, [providerId]: detail || '' }));
    } catch (err) {
      setTesting((prev) => ({ ...prev, [providerId]: 'fail' }));
      setTestDetail((prev) => ({ ...prev, [providerId]: err.message || String(err) }));
    }
  }

  const masked = (key) => typeof settings[key] === 'string' && settings[key].startsWith('••••');
  const hasKey = (keys) => keys.every((k) => !!settings[k.key] && settings[k.key].length > 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys & Limits</h1>
          <p className="text-sm text-gray-400 mt-1">
            Without keys the pipeline runs in mock mode. Drop keys in here, hit save, then hit Test to verify.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-500'
          } text-white disabled:opacity-50`}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {/* Provider cards */}
      {PROVIDERS.map((provider) => {
        const keySet = hasKey(provider.keys);
        const test = testing[provider.id];
        return (
          <div key={provider.id} className="card border border-dark-500 p-5 rounded-lg bg-dark-800/40 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  {provider.title}
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      keySet ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400'
                    }`}
                  >
                    {keySet ? 'key set' : 'no key'}
                  </span>
                </h2>
                <p className="text-sm text-gray-400 mt-1">{provider.summary}</p>
              </div>
              <a
                href={provider.signupUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-sm text-blue-400 hover:text-blue-300 underline"
              >
                Get key →
              </a>
            </div>

            <div className="space-y-3">
              {provider.keys.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-400 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={settings[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={masked(field.key) ? settings[field.key] : field.placeholder}
                    className="w-full bg-dark-900 border border-dark-500 rounded-md px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 text-xs">
              <p className="text-gray-500">
                <span className="text-gray-400">Cost:</span> {provider.costLine}
              </p>
              <button
                type="button"
                onClick={() => testKey(provider.id)}
                disabled={test === 'pending' || !keySet}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                  test === 'ok'
                    ? 'border-green-500/40 text-green-400 bg-green-500/10'
                    : test === 'fail'
                    ? 'border-red-500/40 text-red-400 bg-red-500/10'
                    : 'border-gray-500/30 text-gray-300 hover:border-blue-500 hover:text-blue-400'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {test === 'pending'
                  ? 'Testing…'
                  : test === 'ok'
                  ? '✓ Works'
                  : test === 'fail'
                  ? '✗ Failed'
                  : 'Test key'}
              </button>
            </div>
            {testDetail[provider.id] && (
              <p className={`text-xs font-mono ${test === 'ok' ? 'text-green-400/70' : 'text-red-400/70'}`}>
                {testDetail[provider.id]}
              </p>
            )}
            <p className="text-xs text-gray-500 border-t border-dark-600 pt-3">{provider.helper}</p>
          </div>
        );
      })}

      {/* Limits */}
      <div className="card border border-dark-500 p-5 rounded-lg bg-dark-800/40">
        <h2 className="text-lg font-semibold text-white mb-4">Limits</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {LIMITS_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-gray-400 mb-1">{field.label}</label>
              <input
                type={field.type}
                value={settings[field.key] ?? ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="w-full bg-dark-900 border border-dark-500 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">{field.help}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-500 border border-dark-600 rounded-lg p-4 bg-dark-900/50">
        <p className="font-semibold text-gray-400 mb-1">$50 starter plan</p>
        <p>
          Free tiers cover you through testing. Expect to burn ~$5 on Claude per 5,000 sites + ~$0 on
          Google Maps (under free tier) + ~$0 on SendGrid (free 100/day). Set daily budget to $5 for
          the first real run; raise once you see it actually converts.
        </p>
      </div>
    </div>
  );
}
