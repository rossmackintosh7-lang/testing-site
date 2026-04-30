import { json, error, getUserFromSession, readBody, slugify } from '../projects/_shared.js';

export { json, error, readBody, slugify };

export async function getAdminUser(env, request) {
  const user = await getUserFromSession(env, request);
  if (!user) return null;

  const allowed = String(env.PBI_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.length) {
    return { ...user, admin_error: 'PBI_ADMIN_EMAILS is not set.' };
  }

  if (!allowed.includes(String(user.email || '').toLowerCase())) {
    return null;
  }

  return user;
}

export async function requireAdmin(env, request) {
  const admin = await getAdminUser(env, request);
  if (!admin) return { response: error('Admin access required.', 403) };
  if (admin.admin_error) return { response: error(admin.admin_error, 500) };
  return { admin };
}

export function parseProjectData(project) {
  try {
    return typeof project?.data_json === 'string' ? JSON.parse(project.data_json || '{}') : (project?.data_json || {});
  } catch {
    return {};
  }
}

export function safeJson(value) {
  try { return JSON.stringify(value || {}); } catch { return '{}'; }
}

export async function ensureAdminTables(env) {
  if (!env.DB) return;

  await env.DB.prepare(`
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
    )
  `).run();

  await env.DB.prepare(`
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
    )
  `).run();
}

export async function uniqueSlug(env, base, id) {
  let slug = slugify(base || 'website');
  let c = 2;

  while (true) {
    const existing = await env.DB
      .prepare(`SELECT id FROM projects WHERE public_slug = ? AND id != ? LIMIT 1`)
      .bind(slug, id || '')
      .first();

    if (!existing) return slug;
    slug = `${slugify(base || 'website')}-${c++}`;
  }
}
