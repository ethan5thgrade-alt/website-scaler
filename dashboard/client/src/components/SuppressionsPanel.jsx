import { useEffect, useState } from 'react';

export default function SuppressionsPanel() {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');

  async function refresh() {
    try {
      const res = await fetch('/api/suppressions');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function add(e) {
    e.preventDefault();
    if (!email) return;
    await fetch('/api/suppressions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, reason }),
    });
    setEmail(''); setReason('');
    refresh();
  }

  async function remove(addr) {
    if (!confirm(`Remove ${addr} from suppression list?`)) return;
    await fetch(`/api/suppressions/${encodeURIComponent(addr)}`, { method: 'DELETE' });
    refresh();
  }

  return (
    <div className="card">
      <div className="card-header mb-3">Email Suppressions</div>
      <form onSubmit={add} className="flex flex-wrap gap-2 mb-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="address@example.com"
          className="flex-1 min-w-[200px] bg-dark-800 border border-dark-500 rounded px-3 py-1.5 text-sm text-white"
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="flex-1 min-w-[150px] bg-dark-800 border border-dark-500 rounded px-3 py-1.5 text-sm text-white"
        />
        <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded">Add</button>
      </form>
      {rows.length === 0 ? (
        <div className="text-sm text-gray-400">No suppressed addresses.</div>
      ) : (
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Reason</th>
                <th className="text-left p-2">Source</th>
                <th className="text-right p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-dark-700">
                  <td className="p-2 text-white">{r.email}</td>
                  <td className="p-2 text-gray-400">{r.reason || '—'}</td>
                  <td className="p-2 text-gray-500 text-xs">{r.source || '—'}</td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => remove(r.email)}
                      className="text-xs text-gray-400 hover:text-red-400"
                    >Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
