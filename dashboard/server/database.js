import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'scaler.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Block-waiting up to 5s on SQLITE_BUSY beats surfacing transient
    // contention to callers. WAL mode mostly avoids writer starvation,
    // but the periodic checkpoint + vacuum jobs can still collide.
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    initSchema();
  }
  return db;
}

// Periodic WAL checkpoint — caps the -wal file which otherwise grows
// unbounded on long-running processes. TRUNCATE is the strongest mode:
// it flushes the WAL and then resets the file to zero bytes.
export function startWalCheckpoint(intervalMs = 10 * 60_000) {
  return setInterval(() => {
    try {
      getDb().pragma('wal_checkpoint(TRUNCATE)');
    } catch (err) {
      console.warn('[DB] wal_checkpoint failed:', err.message);
    }
  }, intervalMs).unref();
}

// Archive agent_logs older than `days` into a sibling table and delete
// the originals. Keeps the primary table small for snappy dashboard reads.
export function archiveOldLogs(days = 30) {
  const d = getDb();
  try {
    d.exec(`CREATE TABLE IF NOT EXISTS agent_logs_archive AS SELECT * FROM agent_logs WHERE 0`);
    const cutoff = `datetime('now', '-${Number(days) | 0} days')`;
    d.exec(`
      INSERT INTO agent_logs_archive
        SELECT * FROM agent_logs WHERE created_at < ${cutoff};
      DELETE FROM agent_logs WHERE created_at < ${cutoff};
    `);
  } catch (err) {
    console.warn('[DB] archive failed:', err.message);
  }
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id TEXT UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      category TEXT,
      rating REAL,
      review_count INTEGER DEFAULT 0,
      hours TEXT,
      photos TEXT,
      services TEXT,
      owner_name TEXT,
      owner_email TEXT,
      zip_code TEXT,
      latitude REAL,
      longitude REAL,
      raw_data TEXT,
      status TEXT DEFAULT 'discovered',
      priority INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      builder_agent TEXT,
      html_path TEXT,
      preview_url TEXT,
      build_time_ms INTEGER,
      design_style TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );

    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      site_id INTEGER,
      to_email TEXT,
      to_name TEXT,
      subject TEXT,
      body TEXT,
      status TEXT DEFAULT 'pending',
      provider_id TEXT,
      opened_at DATETIME,
      clicked_at DATETIME,
      replied_at DATETIME,
      bounced INTEGER DEFAULT 0,
      unsubscribed INTEGER DEFAULT 0,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (site_id) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      site_id INTEGER NOT NULL,
      amount REAL DEFAULT 50.00,
      business_name TEXT,
      location TEXT,
      builder_agent TEXT,
      claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (site_id) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL,
      action TEXT,
      status TEXT,
      message TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_status (
      agent_name TEXT PRIMARY KEY,
      status TEXT DEFAULT 'offline',
      last_heartbeat DATETIME,
      restart_count INTEGER DEFAULT 0,
      last_restart DATETIME,
      cpu_usage REAL DEFAULT 0,
      memory_usage REAL DEFAULT 0,
      tasks_completed INTEGER DEFAULT 0,
      avg_response_ms REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT,
      tokens_used INTEGER,
      cost_estimate REAL,
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS uptime_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT,
      agent_name TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      severity TEXT DEFAULT 'warning',
      agent_name TEXT,
      description TEXT,
      suggested_fix TEXT,
      resolved INTEGER DEFAULT 0,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS business_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      agent_name TEXT,
      step TEXT,
      tokens_used INTEGER DEFAULT 0,
      token_cost REAL DEFAULT 0,
      api_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zip_codes TEXT,
      categories TEXT,
      max_leads INTEGER,
      daily_email_limit INTEGER,
      status TEXT DEFAULT 'pending',
      businesses_found INTEGER DEFAULT 0,
      sites_built INTEGER DEFAULT 0,
      emails_sent INTEGER DEFAULT 0,
      started_at DATETIME,
      finished_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scheduled_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      site_id INTEGER,
      scheduled_at DATETIME NOT NULL,
      booker_name TEXT,
      booker_email TEXT,
      provider TEXT DEFAULT 'calendly',
      provider_event_id TEXT UNIQUE,
      status TEXT DEFAULT 'scheduled',
      tenant_id INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (site_id) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS suppressions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      reason TEXT,
      source TEXT,
      tenant_id INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(email, tenant_id)
    );

    CREATE TABLE IF NOT EXISTS enrichment_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id TEXT NOT NULL,
      business_name TEXT,
      reason TEXT,
      attempts INTEGER DEFAULT 1,
      last_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(place_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      request_id TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_businesses_zip_status ON businesses(zip_code, status);
    CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
    CREATE INDEX IF NOT EXISTS idx_sites_business ON sites(business_id);
    CREATE INDEX IF NOT EXISTS idx_emails_status_sent ON emails(status, sent_at);
    CREATE INDEX IF NOT EXISTS idx_emails_business ON emails(business_id);
    CREATE INDEX IF NOT EXISTS idx_business_costs_business ON business_costs(business_id);
    CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_issues_resolved ON issues(resolved, created_at);
    CREATE INDEX IF NOT EXISTS idx_scheduled_calls_time ON scheduled_calls(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_scheduled_calls_status ON scheduled_calls(status);
    CREATE INDEX IF NOT EXISTS idx_scheduled_calls_business ON scheduled_calls(business_id);
    CREATE INDEX IF NOT EXISTS idx_suppressions_email ON suppressions(email);
    CREATE INDEX IF NOT EXISTS idx_enrichment_failures_place ON enrichment_failures(place_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id);
  `);

  // Phase-2 groundwork: add a nullable tenant_id to the big tables so we can
  // multi-tenant later without a painful migration. Default 1 for today's
  // single-tenant use. Uses ALTER TABLE ADD COLUMN + IF NOT EXISTS guard.
  for (const tbl of ['businesses', 'sites', 'emails', 'sales', 'scheduled_calls']) {
    const cols = db.prepare(`PRAGMA table_info(${tbl})`).all();
    if (!cols.some((c) => c.name === 'tenant_id')) {
      db.exec(`ALTER TABLE ${tbl} ADD COLUMN tenant_id INTEGER DEFAULT 1`);
    }
  }

  // Soft-delete groundwork on businesses so we can "undelete" for 30d
  // without destroying data outright.
  {
    const cols = db.prepare('PRAGMA table_info(businesses)').all();
    if (!cols.some((c) => c.name === 'deleted_at')) {
      db.exec('ALTER TABLE businesses ADD COLUMN deleted_at DATETIME');
    }
    if (!cols.some((c) => c.name === 'notes')) {
      db.exec('ALTER TABLE businesses ADD COLUMN notes TEXT');
    }
  }
  // Notes + outcome tracking on scheduled_calls.
  {
    const cols = db.prepare('PRAGMA table_info(scheduled_calls)').all();
    if (!cols.some((c) => c.name === 'notes')) {
      db.exec('ALTER TABLE scheduled_calls ADD COLUMN notes TEXT');
    }
    if (!cols.some((c) => c.name === 'outcome')) {
      db.exec('ALTER TABLE scheduled_calls ADD COLUMN outcome TEXT');
    }
  }

  // FTS5 virtual table mirroring `businesses` so the Leads search is O(log n)
  // on large lead lists instead of an N× LIKE scan. Triggers keep it in
  // sync on insert/update/delete; we also backfill existing rows the first
  // time the FTS table is created so upgrades don't start with empty search.
  try {
    const existed = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='businesses_fts'")
      .get();
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS businesses_fts USING fts5(
        name, address, phone, category, content='businesses', content_rowid='id'
      );
      CREATE TRIGGER IF NOT EXISTS businesses_ai AFTER INSERT ON businesses BEGIN
        INSERT INTO businesses_fts(rowid, name, address, phone, category)
        VALUES (new.id, new.name, new.address, new.phone, new.category);
      END;
      CREATE TRIGGER IF NOT EXISTS businesses_ad AFTER DELETE ON businesses BEGIN
        INSERT INTO businesses_fts(businesses_fts, rowid, name, address, phone, category)
        VALUES('delete', old.id, old.name, old.address, old.phone, old.category);
      END;
      CREATE TRIGGER IF NOT EXISTS businesses_au AFTER UPDATE ON businesses BEGIN
        INSERT INTO businesses_fts(businesses_fts, rowid, name, address, phone, category)
        VALUES('delete', old.id, old.name, old.address, old.phone, old.category);
        INSERT INTO businesses_fts(rowid, name, address, phone, category)
        VALUES (new.id, new.name, new.address, new.phone, new.category);
      END;
    `);
    if (!existed) {
      db.exec("INSERT INTO businesses_fts(businesses_fts) VALUES('rebuild')");
    }
  } catch (err) {
    // FTS5 may be unavailable in very old SQLite builds — fall back silently.
    console.warn('[DB] FTS5 init skipped:', err.message);
  }

  // Insert default settings if not present
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  const defaults = {
    google_maps_api_key: '',
    llm_provider: 'anthropic',
    anthropic_api_key: '',
    openai_api_key: '',
    email_provider: 'sendgrid',
    sendgrid_api_key: '',
    sendgrid_from_email: '',
    daily_token_limit: '5000000',
    daily_email_limit: '200',
    max_emails_per_hour: '50',
    site_base_url: 'http://localhost:3001/sites',
    current_price: '50',
    avg_cost_per_business: '0',
    price_sample_size: '0',
    calendly_link: '',
    calendly_webhook_secret: '',
    sendgrid_webhook_public_key: '',
    sender_physical_address: '',
    unsubscribe_base_url: '',
    min_review_count: '5',
    scout_negative_keywords: '',
    suppress_generic_addresses: '1',
  };
  for (const [key, value] of Object.entries(defaults)) {
    insertSetting.run(key, value);
  }

  // Insert default agent statuses
  const insertAgent = db.prepare(
    'INSERT OR IGNORE INTO agent_status (agent_name, status) VALUES (?, ?)'
  );
  const agents = [
    'Commander', 'Scout', 'Scraper',
    'Builder-Alpha', 'Builder-Beta', 'Builder-Gamma',
    'Postman', 'Accountant', 'Pricer', 'Sentinel'
  ];
  for (const name of agents) {
    insertAgent.run(name, 'offline');
  }
}

export function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  getDb().prepare(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
  ).run(key, value);
}
