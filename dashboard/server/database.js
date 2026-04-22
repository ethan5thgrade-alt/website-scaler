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
    initSchema();
  }
  return db;
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
  `);

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
    daily_budget_usd: '5',
    current_price: '50',
    avg_cost_per_business: '0',
    price_sample_size: '0',
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
