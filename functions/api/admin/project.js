import { json, error, readBody, requireAdmin, ensureAdminTables, parseProjectData, safeJson } from './_shared.js';

async function loadProject(env, id) {
  return await env.DB.prepare(`
    SELECT projects.*, users.email AS user_email
    FROM projects
    LEFT JOIN users ON users.id = projects.user_id
    WHERE projects.id = ?
    LIMIT 1
  `).bind(id).first();
}

async function relatedRows(env, id) {
  const out = { domains: [], publishes: [], support_requests: [], custom_enquiries: [] };

  try {
    const domains = await env.DB.prepare(`SELECT * FROM domains WHERE project_id = ? ORDER BY hostname`).bind(id).all();
    out.domains = domains.results || [];
  } catch {}

  try {
    const publishes = await env.DB.prepare(`SELECT * FROM publishes WHERE project_id = ? ORDER BY datetime(COALESCE(created_at, id)) DESC`).bind(id).all();
    out.publishes = publishes.results || [];
  } catch {}

  await ensureAdminTables(env);

  try {
    const support = await env.DB.prepare(`SELECT * FROM support_requests WHERE project_id = ? ORDER BY datetime(created_at) DESC`).bind(id).all();
    out.support_requests = support.results || [];
  } catch {}

  try {
    const enquiries = await env.DB.prepare(`SELECT * FROM custom_build_enquiries WHERE project_id = ? ORDER BY datetime(created_at) DESC`).bind(id).all();
    out.custom_enquiries = enquiries.results || [];
  } catch {}

  return out;
}

export async function onRequestGet({ request, env }) {
  const { response } = await requireAdmin(env, request);
  if (response) return response;
  if (!env.DB) return error('Database binding missing.', 500);

  const url = new URL(request.url);
  const id = String(url.searchParams.get('id') || '').trim();
  if (!id) return error('Missing project id.', 400);

  const project = await loadProject(env, id);
  if (!project) return error('Project not found.', 404);

  const data = parseProjectData(project);
  const related = await relatedRows(env, id);

  return json({ ok: true, project: { ...project, data }, related });
}

export async function onRequestPost({ request, env }) {
  const { response } = await requireAdmin(env, request);
  if (response) return response;
  if (!env.DB) return error('Database binding missing.', 500);

  const body = await readBody(request);
  const id = String(body.id || body.project_id || '').trim();
  if (!id) return error('Missing project id.', 400);

  const existing = await loadProject(env, id);
  if (!existing) return error('Project not found.', 404);

  let data = parseProjectData(existing);

  if (body.data && typeof body.data === 'object') {
    data = body.data;
  }

  if (typeof body.data_json === 'string' && body.data_json.trim()) {
    try { data = JSON.parse(body.data_json); }
    catch { return error('Project JSON is not valid.', 400); }
  }

  const name = String(body.name || body.project_name || existing.name || data.project_name || 'Untitled website').trim().slice(0, 140);
  const status = String(body.status || existing.status || 'draft').trim().slice(0, 60);
  const billingStatus = String(body.billing_status || existing.billing_status || '').trim().slice(0, 60);
  const plan = String(body.plan || existing.plan || '').trim().slice(0, 60);
  const domainOption = String(body.domain_option || data.domain_option || existing.domain_option || 'pbi_subdomain').trim().slice(0, 60);
  const customDomain = String(body.custom_domain || data.custom_domain || existing.custom_domain || '').trim().slice(0, 253);
  const publicSlug = String(body.public_slug || existing.public_slug || '').trim().slice(0, 80);
  const published = body.published === true || body.published === '1' || body.published === 1 ? 1 : (Number(existing.published || 0) ? 1 : 0);

  await env.DB.prepare(`
    UPDATE projects
    SET name = ?,
        status = ?,
        data_json = ?,
        billing_status = ?,
        plan = ?,
        domain_option = ?,
        custom_domain = ?,
        public_slug = ?,
        published = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(name, status, safeJson(data), billingStatus, plan, domainOption, customDomain, publicSlug, published, id).run();

  const project = await loadProject(env, id);
  return json({ ok: true, project: { ...project, data: parseProjectData(project) } });
}
