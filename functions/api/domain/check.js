import { json, error } from '../../_lib/json.js';

const SESSION_COOKIE_NAME = 'session_id';
const DEFAULT_TLDS = ['co.uk', 'com', 'uk', 'net', 'org', 'co', 'online', 'site', 'store', 'business', 'dev', 'app'];

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';

  for (const cookie of cookieHeader.split(';').map((item) => item.trim()).filter(Boolean)) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex === -1) continue;

    const cookieName = cookie.slice(0, separatorIndex);
    const cookieValue = cookie.slice(separatorIndex + 1);

    if (cookieName === name) return decodeURIComponent(cookieValue);
  }

  return '';
}

async function getUserFromSession(env, request) {
  const sessionId = getCookie(request, SESSION_COOKIE_NAME);
  if (!sessionId) return null;

  return await env.DB
    .prepare(
      `SELECT sessions.id, sessions.user_id, users.email
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ?
       LIMIT 1`
    )
    .bind(sessionId)
    .first();
}

function cleanDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function cleanKeyword(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\.[a-z0-9.-]+$/, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52);
}

function isValidDomain(domain) {
  if (!domain || domain.length > 253) return false;
  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.includes('..')) return false;
  return /^[a-z0-9.-]+$/.test(domain);
}

function splitDomain(domain) {
  const cleaned = cleanDomain(domain);
  const labels = cleaned.split('.').filter(Boolean);
  if (labels.length < 2) return { sld: cleanKeyword(cleaned), tld: 'co.uk' };

  const lastTwo = labels.slice(-2).join('.');
  const tld = ['co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk'].includes(lastTwo)
    ? lastTwo
    : labels.slice(-1)[0];

  const sldLabels = labels.slice(0, labels.length - tld.split('.').length);
  return {
    sld: cleanKeyword(sldLabels.join('-')) || cleanKeyword(labels[0]),
    tld
  };
}

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function buildSuggestions(domain, keyword) {
  const requested = cleanDomain(domain);
  const parsed = splitDomain(requested || keyword);
  const root = cleanKeyword(keyword || parsed.sld || requested || 'my-business');
  const tld = parsed.tld || 'co.uk';

  const roots = unique([
    root,
    `${root}-uk`,
    `${root}-online`,
    `${root}-studio`,
    `${root}-digital`,
    `${root}-services`,
    `${root}-hq`,
    `the-${root}`,
    `${root}-co`,
    `${root}-group`
  ]).filter((item) => item.length >= 2 && item.length <= 63);

  const domains = [];

  if (requested && isValidDomain(requested)) domains.push(requested);

  for (const extension of unique([tld, ...DEFAULT_TLDS])) {
    if (!extension) continue;
    domains.push(`${root}.${extension}`);
  }

  for (const rootOption of roots.slice(1)) {
    domains.push(`${rootOption}.${tld}`);
    domains.push(`${rootOption}.co.uk`);
    domains.push(`${rootOption}.com`);
  }

  return unique(domains).slice(0, 20);
}

function normaliseDomainResult(item) {
  const pricing = item?.pricing || {};
  const registrationCost = pricing.registration_cost || pricing.registrationCost || '';
  const renewalCost = pricing.renewal_cost || pricing.renewalCost || registrationCost || '';
  const currency = pricing.currency || 'GBP';

  return {
    name: item?.name || item?.domain || '',
    available: item?.registrable === true,
    registrable: item?.registrable === true,
    reason: item?.reason || '',
    tier: item?.tier || '',
    pricing: {
      currency,
      registration_cost: registrationCost,
      renewal_cost: renewalCost
    },
    display_price: registrationCost ? `${currency} ${registrationCost}` : ''
  };
}

function unavailableReason(reason) {
  return {
    domain_unavailable: 'Already registered or unavailable.',
    extension_not_supported_via_api: 'This extension cannot be registered automatically through the API.',
    extension_not_supported: 'This extension is not supported.',
    extension_disallows_registration: 'This extension is not currently accepting registrations.',
    domain_premium: 'Premium domains are not supported for automatic purchase.'
  }[reason] || 'Not available for automatic registration.';
}

export async function onRequestPost({ request, env }) {
  const user = await getUserFromSession(env, request);
  if (!user) return error('Unauthorized.', 401);

  let body = {};
  try { body = await request.json(); } catch { body = {}; }

  const domain = cleanDomain(body.domain);
  const keyword = cleanKeyword(body.keyword || body.business_name || domain);

  if (!domain && !keyword) return error('Enter a domain or business name to check.', 400);

  if (domain && !isValidDomain(domain)) {
    return error('Enter a valid domain, for example yourbusiness.co.uk.', 400);
  }

  if (!env.CLOUDFLARE_ACCOUNT_ID) return error('Missing CLOUDFLARE_ACCOUNT_ID environment variable.', 500);
  if (!env.CLOUDFLARE_API_TOKEN) return error('Missing CLOUDFLARE_API_TOKEN environment variable.', 500);

  const domainsToCheck = buildSuggestions(domain, keyword);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/registrar/domain-check`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domains: domainsToCheck })
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    const message =
      result.errors?.map((item) => item.message).join(', ') ||
      result.messages?.map((item) => item.message).join(', ') ||
      `Cloudflare domain check failed with status ${response.status}`;

    return error(message, response.status || 500);
  }

  const checked = (result.result?.domains || []).map(normaliseDomainResult).filter((item) => item.name);
  const requested = checked.find((item) => item.name === domain) || null;
  const suggestions = checked
    .filter((item) => item.available && item.tier !== 'premium')
    .sort((a, b) => {
      if (a.name === domain) return -1;
      if (b.name === domain) return 1;
      return a.name.length - b.name.length;
    })
    .slice(0, 8);

  return json({
    ok: true,
    query: { domain, keyword },
    requested: requested ? { ...requested, message: requested.available ? 'Available to register.' : unavailableReason(requested.reason) } : null,
    suggestions,
    checked,
    cloudflare: result
  });
}

export async function onRequestGet() {
  return error('Method not allowed.', 405);
}
