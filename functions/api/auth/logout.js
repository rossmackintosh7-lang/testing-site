import { json } from '../../_lib/json.js';
import { destroySession, clearCookie } from '../../_lib/session.js';

export async function onRequestPost({ request, env }) {
  await destroySession(env, request);

  return json(
    { ok: true },
    200,
    {
      'Set-Cookie': clearCookie('session_id', true)
    }
  );
}
