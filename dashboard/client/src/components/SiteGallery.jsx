import { useEffect, useState } from 'react';

// Browse every generated site with thumbnails. Click to open the full preview.
export default function SiteGallery() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sites?limit=100')
      .then((r) => r.json())
      .then((rows) => {
        setSites(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => console.error('Failed to load sites:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Generated Sites</h1>
          <p className="text-sm text-gray-400 mt-1">
            {loading ? 'Loading…' : `${sites.length} site${sites.length === 1 ? '' : 's'} built`}
          </p>
        </div>
      </div>

      {!loading && sites.length === 0 && (
        <div className="card border border-dark-500 p-8 rounded-lg bg-dark-800/40 text-center">
          <p className="text-gray-400">No sites built yet. Deploy a pipeline to start generating.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sites.map((site) => (
          <article
            key={site.id}
            className="card border border-dark-500 rounded-lg bg-dark-800/40 overflow-hidden hover:border-blue-500/40 transition"
          >
            {/* Thumbnail: live iframe scaled down, click-through to full preview */}
            <a
              href={site.preview_url}
              target="_blank"
              rel="noreferrer"
              className="block bg-white"
              title="Open full preview"
            >
              <div className="relative h-40 overflow-hidden">
                {site.preview_url && (
                  <iframe
                    src={site.preview_url}
                    title={site.business_name || 'site'}
                    className="absolute top-0 left-0 origin-top-left"
                    style={{
                      width: '400%',
                      height: '400%',
                      transform: 'scale(0.25)',
                      border: 'none',
                      pointerEvents: 'none',
                    }}
                    sandbox="allow-same-origin"
                  />
                )}
              </div>
            </a>

            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-white text-sm truncate" title={site.business_name}>
                  {site.business_name || 'Untitled business'}
                </h3>
                {site.rating && (
                  <span className="text-[10px] shrink-0 text-amber-400 font-mono">
                    {site.rating}★
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1 truncate">{site.address || ''}</p>
              <div className="flex flex-wrap gap-1.5 mt-3 text-[10px]">
                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300">
                  {site.category || 'other'}
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300">
                  {site.design_style || 'default'}
                </span>
                {site.email_status === 'sent' && (
                  <span className="px-2 py-0.5 rounded bg-green-500/15 text-green-300">
                    emailed
                  </span>
                )}
                {site.opened_at && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                    opened
                  </span>
                )}
                {site.clicked_at && (
                  <span className="px-2 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300">
                    clicked
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-gray-500">
                  by {site.builder_agent || 'Builder'}
                </span>
                <a
                  href={site.preview_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Open →
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
