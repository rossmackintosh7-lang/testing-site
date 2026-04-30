import { json, error } from '../../_lib/json.js';

function readCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';

  const cookies = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex === -1) continue;

    const cookieName = cookie.slice(0, separatorIndex);
    const cookieValue = cookie.slice(separatorIndex + 1);

    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }

  return '';
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function getUserFromSession(env, request) {
  const sessionId = readCookie(request, 'session_id');

  if (!sessionId) {
    return null;
  }

  const session = await env.DB
    .prepare(`
      SELECT
        sessions.id,
        sessions.user_id,
        users.email
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
      LIMIT 1
    `)
    .bind(sessionId)
    .first();

  if (!session) {
    return null;
  }

  return {
    id: session.user_id,
    email: session.email
  };
}

function cleanHostname(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\s+/g, '');
}

function isValidHostname(hostname) {
  if (!hostname) return false;
  if (hostname.length > 253) return false;
  if (!hostname.includes('.')) return false;
  if (hostname.startsWith('.') || hostname.endsWith('.')) return false;
  if (hostname.includes('..')) return false;

  return /^[a-z0-9.-]+$/.test(hostname);
}

export async function onRequestPost({ request, env }) {
  const user = await getUserFromSession(env, request);

  if (!user) {
    return error('Unauthorized.', 401);
  }

  if (!env.CLOUDFLARE_API_TOKEN) {
    return error('Missing CLOUDFLARE_API_TOKEN.', 500);
  }

  if (!env.CLOUDFLARE_ZONE_ID) {
    return error('Missing CLOUDFLARE_ZONE_ID.', 500);
  }

  const body = await readJsonBody(request);

  const hostname = cleanHostname(body.hostname || body.domain || body.custom_domain);

  if (!isValidHostname(hostname)) {
    return error('Enter a valid custom hostname, for example www.customer.co.uk.', 400);
  }

  const ssl = {
    method: 'http',
    type: 'dv',
    settings: {
      min_tls_version: '1.2'
    }
  };

  const payload = {
    hostname,
    ssl,
    custom_origin_server: env.CLOUDFLARE_CUSTOM_ORIGIN || undefined
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === '') {
      delete payload[key];
    }
  });

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    console.log('Cloudflare custom hostname onboarding failed:', JSON.stringify(result, null, 2));

    const message =
      result.errors?.map((item) => item.message).join(', ') ||
      result.messages?.map((item) => item.message).join(', ') ||
      `Cloudflare custom hostname onboarding failed with status ${response.status}`;

    return error(`${message} (status: ${response.status})`, response.status || 500);
  }

  return json({
    ok: true,
    hostname,
    result: result.result,
    cloudflare: result
  });
}

export async function onRequestGet() {
  return error('Method not allowed.', 405);
}
