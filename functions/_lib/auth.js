import { error } from './json.js';
import { getSessionUser } from './session.js';

export async function requireUser(env, request) {
  const user = await getSessionUser(env, request);
  if (!user) {
    return { ok: false, response: error('Unauthorized.', 401) };
  }
  return { ok: true, user };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
