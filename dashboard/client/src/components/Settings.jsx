import { useState, useEffect } from 'react';

const SETTING_GROUPS = [
  {
    title: 'Google Maps API',
    fields: [
      { key: 'google_maps_api_key', label: 'API Key', type: 'password', placeholder: 'AIza...' },
    ],
  },
  {
    title: 'LLM Provider',
    fields: [
      { key: 'llm_provider', label: 'Provider', type: 'select', options: ['anthropic', 'openai'] },
      { key: 'anthropic_api_key', label: 'Anthropic API Key', type: 'password', placeholder: 'sk-ant-...' },
      { key: 'openai_api_key', label: 'OpenAI API Key', type: 'password', placeholder: 'sk-...' },
    ],
  },
  {
    title: 'Email Provider',
    fields: [
      { key: 'email_provider', label: 'Provider', type: 'select', options: ['sendgrid', 'mailgun', 'ses'] },
      { key: 'sendgrid_api_key', label: 'SendGrid API Key', type: 'password', placeholder: 'SG...' },
      { key: 'sendgrid_from_email', label: 'From Email', type: 'email', placeholder: 'hello@yourdomain.com' },
    ],
  },
  {
    title: 'Limits & Configuration',
    fields: [
      { key: 'daily_token_limit', label: 'Daily Token Limit', type: 'number' },
      { key: 'daily_email_limit', label: 'Daily Email Limit', type: 'number' },
      { key: 'max_emails_per_hour', label: 'Max Emails Per Hour', type: 'number' },
      { key: 'site_base_url', label: 'Site Base URL', type: 'text', placeholder: 'http://localhost:3001/sites' },
    ],
  },
];

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error);

    fetch('/api/settings/validate')
      .then((r) => r.json())
      .then(setValidation)
      .catch(console.error);
  }, []);

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
      // Re-validate
      const v = await fetch('/api/settings/validate').then((r) => r.json());
      setValidation(v);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          } disabled:opacity-50`}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Validation Status */}
      {validation && (
        <div className={`card border ${validation.allValid ? 'border-green-500/30' : 'border-yellow-500/30'}`}>
          <div className="card-header mb-2">API Status</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(validation.checks).map(([key, valid]) => (
              <div
                key={key}
                className={`flex items-center gap-2 text-sm ${valid ? 'text-green-400' : 'text-yellow-400'}`}
              >
                <span>{valid ? '\u2713' : '\u25CB'}</span>
                <span>{key.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
          {!validation.allValid && (
            <p className="text-xs text-yellow-400/70 mt-2">
              Missing API keys will use mock data. Add keys to connect to real services.
            </p>
          )}
        </div>
      )}

      {/* Setting Groups */}
      {SETTING_GROUPS.map((group) => (
        <div key={group.title} className="card">
          <div className="card-header mb-4">{group.title}</div>
          <div className="space-y-4">
            {group.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm text-gray-300 mb-1">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    value={settings[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                  >
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'password' ? 'password' : field.type}
                    value={settings[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card border-dark-500">
        <div className="card-header mb-2">How It Works</div>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li>Without API keys, all agents run in <span className="text-yellow-400">mock mode</span> with simulated data</li>
          <li>Add your <span className="text-blue-400">Google Maps API key</span> to discover real businesses</li>
          <li>Add an <span className="text-purple-400">Anthropic or OpenAI key</span> for AI-generated website content</li>
          <li>Add a <span className="text-green-400">SendGrid key</span> to send real emails</li>
          <li>You can mix-and-match: use real Google Maps with mock emails, etc.</li>
        </ul>
      </div>
    </div>
  );
}
