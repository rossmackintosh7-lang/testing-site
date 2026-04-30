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
