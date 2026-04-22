// Shared dispatch for building demo sites outside the pipeline — used by
// the Calendly webhook when a prospect books a call, and by the "build
// demo now" button on the dashboard.

let registry = null;

export function registerBuilders(builders, deps) {
  registry = { builders, deps, rr: 0 };
}

export async function buildDemoForBusiness(businessId, { reason = 'manual' } = {}) {
  if (!registry) throw new Error('Builder registry not initialized');
  const { builders, deps, rr } = registry;
  const { db, broadcast, accountant, pricer } = deps;

  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!biz) throw new Error(`Business ${businessId} not found`);

  // Rehydrate enriched data from raw_data if present so the demo uses
  // everything we scraped (services, hours, photos, reviews, editorial).
  let enriched = { ...biz };
  try {
    if (biz.raw_data) {
      const raw = JSON.parse(biz.raw_data);
      enriched = { ...raw, id: biz.id };
    }
  } catch (_) {
    // fall through with the flat row
  }
  // Ensure parsed fields are objects/arrays, not JSON strings.
  for (const k of ['hours', 'photos', 'services']) {
    if (typeof enriched[k] === 'string') {
      try { enriched[k] = JSON.parse(enriched[k]); } catch (_) { /* ignore */ }
    }
  }

  const builder = builders[registry.rr++ % builders.length];
  broadcast('demo_build_started', { businessId, reason, builder: builder.name });

  const result = await builder.buildSite(enriched);

  const siteRow = db.prepare(
    'INSERT INTO sites (business_id, builder_agent, html_path, preview_url, build_time_ms, design_style, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(biz.id, builder.name, result.htmlPath, result.previewUrl, result.buildTime, result.designStyle, 'completed');

  if (result.usage && accountant) {
    accountant.trackUsage(builder.name, result.usage, result.model);
  }
  if (result.usage && pricer) {
    pricer.trackBusinessCost(biz.id, builder.name, result.usage, result.model, 'build');
  }

  db.prepare('UPDATE businesses SET status = ? WHERE id = ?').run('demo_built', biz.id);
  broadcast('demo_build_completed', { businessId, siteId: siteRow.lastInsertRowid, previewUrl: result.previewUrl });

  return { siteId: siteRow.lastInsertRowid, previewUrl: result.previewUrl };
}
