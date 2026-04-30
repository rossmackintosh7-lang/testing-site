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

export async function onRequestGet({ request, env }) {
  try {
    const sessionId = getCookie(request, SESSION_COOKIE_NAME);

    if (!sessionId) {
      return error('Unauthorized.', 401);
    }

    if (!env.DB) {
      return error('Database binding missing.', 500);
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
      return error('Unauthorized.', 401);
    }

    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?')
        .bind(sessionId)
        .run();

      return error('Session expired.', 401);
    }

    await env.DB.prepare(
      `
      UPDATE sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `
    )
      .bind(sessionId)
      .run();

    return json({
      ok: true,
      user: {
        id: session.user_id,
        email: session.email
      }
    });
  } catch (err) {
    return error(err?.message || 'Failed to read session.', 500);
  }
}
