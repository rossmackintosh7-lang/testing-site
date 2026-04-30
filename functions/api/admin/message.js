import { json, error, readBody, requireAdmin, ensureAdminTables } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const { response } = await requireAdmin(env, request);
  if (response) return response;
  if (!env.DB) return error('Database binding missing.', 500);
  await ensureAdminTables(env);

  const body = await readBody(request);
  const type = String(body.type || '').trim();
  const id = String(body.id || '').trim();
  const status = String(body.status || 'reviewed').trim().slice(0, 40);

  if (!id) return error('Missing id.', 400);

  if (type === 'custom_enquiry') {
    await env.DB.prepare(`UPDATE custom_build_enquiries SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(status, id).run();
    return json({ ok: true });
  }

  if (type === 'support_request') {
    await env.DB.prepare(`UPDATE support_requests SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(status, id).run();
    return json({ ok: true });
  }

  return error('Unknown message type.', 400);
}
