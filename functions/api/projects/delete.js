import { json, error, readBody, getUserFromSession } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const user = await getUserFromSession(env, request);
  if (!user) return error('Unauthorized.', 401);

  const body = await readBody(request);
  const projectId = String(body.project_id || body.id || body.projectId || '').trim();
  if (!projectId) return error('Missing project id.', 400);

  const project = await env.DB
    .prepare('SELECT id, user_id, name, stripe_subscription_id FROM projects WHERE id = ? AND user_id = ? LIMIT 1')
    .bind(projectId, user.id)
    .first();

  if (!project) return error('Project not found.', 404);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM publishes WHERE project_id = ?').bind(projectId),
    env.DB.prepare('DELETE FROM domains WHERE project_id = ?').bind(projectId),
    env.DB.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').bind(projectId, user.id)
  ]);

  return json({
    ok: true,
    deleted: true,
    project_id: projectId,
    stripe_subscription_id: project.stripe_subscription_id || '',
    billing_note: project.stripe_subscription_id
      ? 'Project deleted from PBI. Cancel the linked Stripe subscription separately if billing should stop.'
      : ''
  });
}

export async function onRequestGet() {
  return error('Method not allowed.', 405);
}
