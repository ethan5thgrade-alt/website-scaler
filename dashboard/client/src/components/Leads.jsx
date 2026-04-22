import { useEffect, useState } from 'react';

const STATUS_COLOR = {
  discovered:  'bg-gray-500/20 text-gray-300 border-gray-500/30',
  scraped:     'bg-blue-500/20 text-blue-300 border-blue-500/30',
  pitched:     'bg-purple-500/20 text-purple-300 border-purple-500/30',
  scheduled:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
  demo_built:  'bg-green-500/20 text-green-300 border-green-500/30',
  site_built:  'bg-green-500/20 text-green-300 border-green-500/30',
  completed:   'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export default function Leads() {
  const [rows, setRows] = useState([]);
  const [facets, setFacets] = useState({ zips: [], categories: [], statuses: [] });
  const [q, setQ] = useState('');
  const [zip, setZip] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  async function fetchLeads() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (zip) params.set('zip', zip);
    if (category) params.set('category', category);
    if (status) params.set('status', status);
    params.set('limit', '200');
    const res = await fetch(`/api/businesses?${params.toString()}`);
    const data = await res.json();
    setRows(Array.isArray(data?.businesses) ? data.businesses : []);
    if (data?.facets) setFacets(data.facets);
    setLoading(false);
  }

  useEffect(() => {
    fetchLeads();
  }, [zip, category, status]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(fetchLeads, 300);
    return () => clearTimeout(t);
  }, [q]);

  const reset = () => { setQ(''); setZip(''); setCategory(''); setStatus(''); };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">Leads</h1>
        <div className="text-sm text-gray-400">{rows.length} shown</div>
      </div>

      <div className="bg-dark-800 border border-dark-500 rounded-lg p-3 mb-4 flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, address, phone…"
          className="flex-1 min-w-[200px] bg-dark-900 border border-dark-500 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
        />
        <select value={zip} onChange={(e) => setZip(e.target.value)} className="bg-dark-900 border border-dark-500 rounded px-2 py-1.5 text-sm text-white">
          <option value="">All zips</option>
          {facets.zips.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-dark-900 border border-dark-500 rounded px-2 py-1.5 text-sm text-white">
          <option value="">All categories</option>
          {facets.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-dark-900 border border-dark-500 rounded px-2 py-1.5 text-sm text-white">
          <option value="">All statuses</option>
          {facets.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={reset} className="text-sm text-gray-400 hover:text-white px-2">Reset</button>
      </div>

      {loading ? (
        <div className="text-gray-400 p-8">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-400 p-12 bg-dark-800 border border-dark-500 rounded-lg">No leads match these filters.</div>
      ) : (
        <div className="overflow-x-auto bg-dark-800 border border-dark-500 rounded-lg">
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-xs uppercase bg-dark-900/40">
              <tr>
                <th className="text-left p-3">Business</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Zip</th>
                <th className="text-right p-3">Rating</th>
                <th className="text-right p-3">Reviews</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Owner email</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-dark-700 hover:bg-dark-700/30">
                  <td className="p-3">
                    <div className="text-white font-medium">{r.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs">{r.address}</div>
                  </td>
                  <td className="p-3 text-gray-300">{r.category || '—'}</td>
                  <td className="p-3 text-gray-300">{r.zip_code || '—'}</td>
                  <td className="p-3 text-right text-gray-300">{r.rating ? r.rating.toFixed(1) : '—'}</td>
                  <td className="p-3 text-right text-gray-300">{r.review_count ?? '—'}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLOR[r.status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}>
                      {r.status || 'unknown'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400 text-xs truncate max-w-[220px]">{r.owner_email || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
