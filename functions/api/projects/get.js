import { json, error } from '../../_lib/json.js';

const SESSION_COOKIE_NAME = 'session_id';

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';

  const cookies = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const cookieName = cookie.slice(0, separatorIndex);
    const cookieValue = cookie.slice(separatorIndex + 1);

    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }

  return null;
}

async function getCurrentUser(request, env) {
  const sessionId = getCookie(request, SESSION_COOKIE_NAME);

  if (!sessionId) {
    return null;
  }

  const session = await env.DB.prepare(
    `
    SELECT
      sessions.id,
      sessions.user_id,
      sessions.expires_at,
      users.email
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ?
    LIMIT 1
    `
  )
    .bind(sessionId)
    .first();

  if (!session) {
    return null;
  }

  const expiresAt = new Date(session.expires_at);

  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?')
      .bind(sessionId)
      .run();

    return null;
  }

  return {
    id: session.user_id,
    email: session.email
  };
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DB) {
      return error('Database binding missing.', 500);
    }

    const user = await getCurrentUser(request, env);

    if (!user) {
      return error('Unauthorized.', 401);
    }

    const url = new URL(request.url);
    const projectId = String(url.searchParams.get('id') || '').trim();

    if (!projectId) {
      return error('Project ID missing.', 400);
    }

    const project = await env.DB.prepare(
      `
      SELECT id, user_id, name, status, data_json, created_at, updated_at
      FROM projects
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `
    )
      .bind(projectId, user.id)
      .first();

    if (!project) {
      return error('Project not found.', 404);
    }

    return json({
      ok: true,
      project
    });
  } catch (err) {
    return error(err?.message || 'Failed to load project.', 500);
  }
}
