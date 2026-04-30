import { json, error, requireAdmin, ensureAdminTables, parseProjectData } from './_shared.js';

function safeCount(rows) {
  return Array.isArray(rows) ? rows.length : 0;
}

function enrichProject(project) {
  const data = parseProjectData(project);
  return {
    ...project,
    data,
    business_name: data.business_name || '',
    subdomain_slug: data.subdomain_slug || '',
    main_promotion_goal: data.main_promotion_goal || '',
    assisted_setup_paid: data.assisted_setup_paid === true,
    custom_build_enquiry_submitted: data.custom_build_enquiry_submitted === true,
    domain_registration: data.domain_registration || null,
    domain_management: data.domain_management || null,
    readiness_score: data.readiness_score || null
  };
}

export async function onRequestGet({ request, env }) {
  const { admin, response } = await requireAdmin(env, request);
  if (response) return response;
  if (!env.DB) return error('Database binding missing.', 500);

  await ensureAdminTables(env);

  const usersResult = await env.DB.prepare(`
    SELECT id, email, email_verified, created_at, updated_at
    FROM users
    ORDER BY datetime(created_at) DESC
    LIMIT 250
  `).all();

  const projectsResult = await env.DB.prepare(`
    SELECT
      projects.*,
      users.email AS user_email
    FROM projects
    LEFT JOIN users ON users.id = projects.user_id
    ORDER BY datetime(COALESCE(projects.updated_at, projects.created_at)) DESC
    LIMIT 500
  `).all();

  const enquiriesResult = await env.DB.prepare(`
    SELECT *
    FROM custom_build_enquiries
    ORDER BY datetime(created_at) DESC
    LIMIT 100
  `).all();

  const supportResult = await env.DB.prepare(`
    SELECT *
    FROM support_requests
    ORDER BY datetime(created_at) DESC
    LIMIT 100
  `).all();

  const projects = (projectsResult.results || []).map(enrichProject);
  const users = usersResult.results || [];
  const enquiries = enquiriesResult.results || [];
  const support_requests = supportResult.results || [];

  const stats = {
    users: safeCount(users),
    projects: safeCount(projects),
    published_projects: projects.filter((project) => Number(project.published) === 1).length,
    active_billing: projects.filter((project) => project.billing_status === 'active').length,
    custom_enquiries: safeCount(enquiries),
    support_requests: safeCount(support_requests),
    assisted_setup_paid: projects.filter((project) => project.assisted_setup_paid).length,
    new_domain_projects: projects.filter((project) => project.domain_option === 'register_new' || project.domain_registration?.name).length
  };

  return json({ ok: true, admin, stats, users, projects, enquiries, support_requests });
}

export async function onRequestPost() {
  return error('Method not allowed.', 405);
}
