CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, password_salt TEXT);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at TEXT);
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, status TEXT DEFAULT 'draft', data_json TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS domains (id TEXT PRIMARY KEY, project_id TEXT, hostname TEXT UNIQUE, status TEXT DEFAULT 'pending', provider_ref TEXT, verification_json TEXT);
CREATE TABLE IF NOT EXISTS publishes (id TEXT PRIMARY KEY, project_id TEXT, status TEXT DEFAULT 'queued', target_hostname TEXT, details_json TEXT);


CREATE TABLE IF NOT EXISTS custom_build_enquiries (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  business_name TEXT,
  main_promotion_goal TEXT,
  status TEXT DEFAULT 'new',
  body_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  user_id TEXT,
  email TEXT,
  type TEXT DEFAULT 'assisted_setup',
  message TEXT,
  status TEXT DEFAULT 'new',
  body_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
