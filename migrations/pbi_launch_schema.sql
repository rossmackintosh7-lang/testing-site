-- PBI launch, billing and publishing fields.
-- Run this once against your Cloudflare D1 database.
-- If D1 says a column already exists, ignore that line and continue.

ALTER TABLE projects ADD COLUMN published INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN public_slug TEXT;
ALTER TABLE projects ADD COLUMN plan TEXT DEFAULT 'free_preview';
ALTER TABLE projects ADD COLUMN billing_status TEXT DEFAULT 'draft';
ALTER TABLE projects ADD COLUMN domain_option TEXT DEFAULT 'pbi_subdomain';
ALTER TABLE projects ADD COLUMN custom_domain TEXT;
ALTER TABLE projects ADD COLUMN published_at TEXT;
ALTER TABLE projects ADD COLUMN stripe_session_id TEXT;
ALTER TABLE projects ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE projects ADD COLUMN stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_public_slug ON projects(public_slug);
CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at);
