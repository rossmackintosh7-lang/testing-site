import { json, error } from '../../_lib/json.js';
import { verifyTurnstileDetailed } from '../../_lib/turnstile.js';
import { verifyPassword } from '../../_lib/crypto.js';
import { createSession, makeSetCookie } from '../../_lib/session.js';
import { readJson } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return error('Invalid request body.');

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const token = String(body.turnstileToken || '');

  if (!email || !password) {
    return error('Email and password are required.');
  }

  if (!token) {
    return error('Turnstile token missing. Refresh the page and complete the security check again.');
  }

  const turnstile = await verifyTurnstileDetailed(
    env,
    token,
    request.headers.get('CF-Connecting-IP') || ''
  );

  if (!turnstile.success) {
    return error(turnstile.reason || 'Turnstile validation failed.', 400, {
      turnstileCode: turnstile.code || 'unknown',
      turnstileErrors: turnstile.errorCodes || [],
      turnstileHostname: turnstile.hostname || ''
    });
  }

  const user = await env.DB
    .prepare('SELECT id, email, password_hash, password_salt, email_verified FROM users WHERE email = ? LIMIT 1')
    .bind(email)
    .first();

  if (!user) {
    return error('Invalid email or password.', 401);
  }

  const valid = await verifyPassword(password, user.password_salt, user.password_hash);

  if (!valid) {
    return error('Invalid email or password.', 401);
  }

  const session = await createSession(env, user.id);

  return json(
    {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        email_verified: Boolean(user.email_verified)
      }
    },
    200,
    {
      'Set-Cookie': makeSetCookie('session_id', session.id, 60 * 60 * 24 * 30, true)
    }
  );
}
