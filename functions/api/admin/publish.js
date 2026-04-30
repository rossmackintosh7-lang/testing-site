import { json, error, readBody, requireAdmin, parseProjectData, safeJson, uniqueSlug } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const { response } = await requireAdmin(env, request);
  if (response) return response;
  if (!env.DB) return error('Database binding missing.', 500);

  const body = await readBody(request);
  const id = String(body.project_id || body.id || '').trim();
  if (!id) return error('Missing project id.', 400);

  const project = await env.DB.prepare(`SELECT * FROM projects WHERE id = ? LIMIT 1`).bind(id).first();
  if (!project) return error('Project not found.', 404);

  const data = parseProjectData(project);
  const publicSlug = project.public_slug || await uniqueSlug(env, data.subdomain_slug || data.business_name || project.name || 'website', project.id);
  const domainOption = String(body.domain_option || data.domain_option || project.domain_option || 'pbi_subdomain');
  const customDomain = String(data.custom_domain || project.custom_domain || '').trim();

  data.admin_published_at = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE projects
    SET published = 1,
        public_slug = ?,
        domain_option = ?,
        custom_domain = ?,
        data_json = ?,
        published_at = COALESCE(published_at, datetime('now')),
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(publicSlug, domainOption, customDomain, safeJson(data), project.id).run();

  return json({
    ok: true,
    published: true,
    public_slug: publicSlug,
    live_url: `/site/${encodeURIComponent(publicSlug)}/`,
    domain_option: domainOption,
    custom_domain: customDomain
  });
}
