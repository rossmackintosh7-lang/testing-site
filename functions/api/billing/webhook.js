import { json, error } from '../projects/_shared.js';

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

function isValidDomain(domain) {
  if (!domain || domain.length > 253) return false;
  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.includes('..')) return false;
  return /^[a-z0-9.-]+$/.test(domain);
}

function parseJson(value, fallback = {}) {
  try {
    if (!value) return fallback;
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

async function hmacSha256(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function parseStripeSignature(header) {
  const parts = String(header || '').split(',').map((item) => item.trim());
  const out = {};
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    if (!out[key]) out[key] = [];
    out[key].push(value);
  }
  return out;
}

async function verifyStripeSignature(request, env, rawBody) {
  if (!env.STRIPE_WEBHOOK_SECRET) return true;
  const header = request.headers.get('Stripe-Signature') || '';
  const parsed = parseStripeSignature(header);
  const timestamp = parsed.t?.[0];
  const signatures = parsed.v1 || [];
  if (!timestamp || !signatures.length) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256(env.STRIPE_WEBHOOK_SECRET, signedPayload);
  return signatures.includes(expected);
}

async function getProjectData(env, projectId, userId = '') {
  const project = await env.DB
    .prepare(`SELECT data_json FROM projects WHERE id = ? AND (? = '' OR user_id = ?) LIMIT 1`)
    .bind(projectId, userId || '', userId || '')
    .first();

  if (!project) return null;
  return parseJson(project.data_json, {});
}

async function updateProjectData(env, projectId, userId, updates) {
  const data = (await getProjectData(env, projectId, userId)) || {};
  const next = { ...data, ...updates };

  await env.DB
    .prepare(`UPDATE projects SET data_json = ?, updated_at = datetime('now') WHERE id = ? AND (? = '' OR user_id = ?)`)
    .bind(JSON.stringify(next), projectId, userId || '', userId || '')
    .run();

  return next;
}

async function markProjectData(env, projectId, userId, updates) {
  await updateProjectData(env, projectId, userId, updates);
}

async function checkDomainAvailability(env, domainName) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/registrar/domain-check`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domains: [domainName] })
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.errors?.map((item) => item.message).join(', ') || `Cloudflare domain check failed with status ${response.status}`);
  }

  return result.result?.domains?.[0] || null;
}

async function registerDomain(env, domainName) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/registrar/registrations`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domain_name: domainName })
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.errors?.map((item) => item.message).join(', ') || `Cloudflare registration failed with status ${response.status}`);
  }

  return result.result || result;
}

function isoFromUnix(seconds) {
  const n = Number(seconds || 0);
  if (!n) return '';
  return new Date(n * 1000).toISOString();
}

function addYearsIso(date = new Date(), years = 1) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
}

function invoiceIncludesPrice(invoice, priceId) {
  if (!priceId) return false;
  const lines = invoice?.lines?.data || [];
  return lines.some((line) => line?.price?.id === priceId || line?.pricing?.price_details?.price === priceId);
}

async function findProjectBySubscription(env, subscriptionId) {
  if (!subscriptionId) return null;
  return env.DB
    .prepare(`SELECT id, user_id, data_json FROM projects WHERE stripe_subscription_id = ? LIMIT 1`)
    .bind(subscriptionId)
    .first();
}

function subscriptionHasDomainManagement(subscription, env) {
  const priceId = String(env.STRIPE_PRICE_DOMAIN_MANAGEMENT_YEARLY || '').trim();
  if (!priceId) return false;
  return (subscription?.items?.data || []).some((item) => item?.price?.id === priceId || item?.plan?.id === priceId);
}

async function handleDomainRegistrationAfterPayment(env, { projectId, userId, session, domainOption }) {
  if (domainOption !== 'register_new') return;

  const selectedDomain = cleanDomain(session.metadata?.selected_domain || '');
  if (!selectedDomain || !isValidDomain(selectedDomain)) return;

  const data = (await getProjectData(env, projectId, userId)) || {};
  const registrationData = parseJson(session.metadata?.domain_registration, data.domain_registration || {});
  const now = new Date().toISOString();

  const domainManagement = {
    ...(data.domain_management || {}),
    status: 'active',
    active: true,
    linked_to_website_subscription: true,
    stripe_subscription_id: session.subscription || '',
    stripe_customer_id: session.customer || '',
    price_id: session.metadata?.domain_management_price_id || env.STRIPE_PRICE_DOMAIN_MANAGEMENT_YEARLY || '',
    annual_fee_minor: Number(session.metadata?.domain_management_fee_amount || env.DOMAIN_MANAGEMENT_FEE_AMOUNT_MINOR || 1000),
    currency: String(session.metadata?.domain_management_fee_currency || env.DOMAIN_MANAGEMENT_FEE_CURRENCY || 'gbp').toLowerCase(),
    interval: 'year',
    started_at: now,
    next_fee_estimate_at: addYearsIso(now, 1)
  };

  const baseUpdate = {
    domain_management: domainManagement,
    domain_registration: {
      ...registrationData,
      name: selectedDomain,
      paid_at: now,
      stripe_session_id: session.id || '',
      stripe_customer_id: session.customer || '',
      stripe_subscription_id: session.subscription || ''
    }
  };

  if (env.DOMAIN_AUTO_REGISTER !== 'true') {
    await updateProjectData(env, projectId, userId, {
      ...baseUpdate,
      domain_registration_status: 'paid_pending_manual_registration',
      domain_registration_message: 'Domain fee paid. Automatic registration is disabled.'
    });

    await env.DB
      .prepare(`UPDATE projects SET custom_domain = ?, domain_option = 'register_new', updated_at = datetime('now') WHERE id = ? AND (? = '' OR user_id = ?)`)
      .bind(selectedDomain, projectId, userId || '', userId || '')
      .run();

    return;
  }

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    await updateProjectData(env, projectId, userId, {
      ...baseUpdate,
      domain_registration_status: 'paid_registration_blocked',
      domain_registration_message: 'Missing Cloudflare registrar environment variables.'
    });
    return;
  }

  try {
    const liveCheck = await checkDomainAvailability(env, selectedDomain);

    if (!liveCheck?.registrable || liveCheck.tier === 'premium') {
      await updateProjectData(env, projectId, userId, {
        ...baseUpdate,
        domain_registration_status: 'paid_registration_failed',
        domain_registration_message: liveCheck?.reason || 'Domain was not registrable at the final payment check.',
        domain_registration_final_check: liveCheck || null
      });
      return;
    }

    const registration = await registerDomain(env, selectedDomain);

    await updateProjectData(env, projectId, userId, {
      ...baseUpdate,
      domain_registration_status: 'registered',
      domain_registration_message: 'Domain registered successfully through Cloudflare Registrar.',
      domain_registration_provider_result: registration
    });

    await env.DB
      .prepare(`UPDATE projects SET custom_domain = ?, domain_option = 'register_new', updated_at = datetime('now') WHERE id = ? AND (? = '' OR user_id = ?)`)
      .bind(selectedDomain, projectId, userId || '', userId || '')
      .run();

    await env.DB
      .prepare(`INSERT OR REPLACE INTO domains (id, project_id, hostname, status, provider_ref, verification_json) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(`domain_${selectedDomain}`, projectId, selectedDomain, 'registered', registration.id || registration.domain_name || selectedDomain, JSON.stringify(registration))
      .run();
  } catch (err) {
    await updateProjectData(env, projectId, userId, {
      ...baseUpdate,
      domain_registration_status: 'paid_registration_failed',
      domain_registration_message: err?.message || 'Domain registration failed after payment.'
    });
  }
}

async function updateSubscriptionStatus(env, subscription) {
  const projectId = subscription.metadata?.project_id || '';
  const userId = subscription.metadata?.user_id || '';
  if (!projectId) return;

  const status = subscription.status || '';
  const hasDomainManagement = subscriptionHasDomainManagement(subscription, env) || subscription.metadata?.includes_domain_management === 'true';
  const domainItem = (subscription.items?.data || []).find((item) => item?.price?.id === env.STRIPE_PRICE_DOMAIN_MANAGEMENT_YEARLY || item?.plan?.id === env.STRIPE_PRICE_DOMAIN_MANAGEMENT_YEARLY);

  const updates = {
    stripe_subscription_status: status,
    website_subscription_status: status,
    subscription_updated_at: new Date().toISOString()
  };

  if (hasDomainManagement) {
    const data = (await getProjectData(env, projectId, userId)) || {};
    updates.domain_management = {
      ...(data.domain_management || {}),
      status,
      active: ['active', 'trialing'].includes(status),
      stripe_subscription_id: subscription.id || '',
      price_id: env.STRIPE_PRICE_DOMAIN_MANAGEMENT_YEARLY || data.domain_management?.price_id || '',
      current_period_start: isoFromUnix(domainItem?.current_period_start),
      current_period_end: isoFromUnix(domainItem?.current_period_end),
      updated_at: new Date().toISOString()
    };
  }

  await updateProjectData(env, projectId, userId, updates);

  if (status === 'active' || status === 'trialing') {
    await env.DB
      .prepare(`UPDATE projects SET billing_status = 'active', stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ? AND (? = '' OR user_id = ?)`)
      .bind(subscription.id || '', projectId, userId || '', userId || '')
      .run();
  }

  if (['canceled', 'unpaid', 'past_due'].includes(status)) {
    await env.DB
      .prepare(`UPDATE projects SET billing_status = ?, updated_at = datetime('now') WHERE id = ? AND (? = '' OR user_id = ?)`)
      .bind(status === 'canceled' ? 'cancelled' : status, projectId, userId || '', userId || '')
      .run();
  }
}

async function updateInvoiceStatus(env, invoice, paid) {
  const subscriptionId = invoice.subscription || invoice.subscription_details?.subscription || invoice.parent?.subscription_details?.subscription || '';
  const project = await findProjectBySubscription(env, subscriptionId);
  if (!project) return;

  const data = parseJson(project.data_json, {});
  const now = new Date().toISOString();
  const includesDomainManagement = invoiceIncludesPrice(invoice, env.STRIPE_PRICE_DOMAIN_MANAGEMENT_YEARLY);
  const updates = {
    last_invoice_id: invoice.id || '',
    last_invoice_status: paid ? 'paid' : 'failed',
    last_invoice_at: now,
    last_invoice_amount_paid: invoice.amount_paid || 0,
    last_invoice_currency: invoice.currency || ''
  };

  if (paid) {
    updates.last_payment_succeeded_at = now;
  } else {
    updates.last_payment_failed_at = now;
  }

  if (includesDomainManagement) {
    updates.domain_management = {
      ...(data.domain_management || {}),
      status: paid ? 'active' : 'payment_failed',
      active: paid,
      last_invoice_id: invoice.id || '',
      last_paid_at: paid ? now : data.domain_management?.last_paid_at || '',
      last_failed_at: paid ? data.domain_management?.last_failed_at || '' : now,
      next_fee_estimate_at: paid ? addYearsIso(now, 1) : data.domain_management?.next_fee_estimate_at || ''
    };
  }

  await updateProjectData(env, project.id, project.user_id, updates);

  if (!paid) {
    await env.DB
      .prepare(`UPDATE projects SET billing_status = 'past_due', updated_at = datetime('now') WHERE id = ?`)
      .bind(project.id)
      .run();
  }
}

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  const verified = await verifyStripeSignature(request, env, rawBody);
  if (!verified) return error('Invalid Stripe webhook signature.', 400);

  let event = {};
  try { event = JSON.parse(rawBody); } catch { return error('Invalid webhook JSON.', 400); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object || {};
    const projectId = session.metadata?.project_id || session.client_reference_id;
    const userId = session.metadata?.user_id || '';
    const plan = session.metadata?.plan || 'business';
    const domainOption = session.metadata?.domain_option || 'pbi_subdomain';

    if (projectId && plan === 'assisted_setup') {
      await markProjectData(env, projectId, userId, {
        assisted_setup_paid: true,
        assisted_setup_paid_at: new Date().toISOString(),
        assisted_setup_status: 'active'
      });
    } else if (projectId && plan === 'custom_build_deposit') {
      await markProjectData(env, projectId, userId, {
        custom_build_deposit_paid: true,
        custom_build_deposit_paid_at: new Date().toISOString(),
        custom_build_status: 'deposit_paid'
      });

      await env.DB
        .prepare(`UPDATE projects SET billing_status = 'custom_build_deposit_paid', updated_at = datetime('now') WHERE id = ? AND (? = '' OR user_id = ?)`)
        .bind(projectId, userId, userId)
        .run();
    } else if (projectId) {
      await env.DB
        .prepare(`UPDATE projects SET billing_status = 'active', plan = ?, domain_option = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ? AND (? = '' OR user_id = ?)`)
        .bind(plan, domainOption, session.customer || '', session.subscription || '', projectId, userId, userId)
        .run();

      await updateProjectData(env, projectId, userId, {
        website_subscription_status: 'active',
        stripe_customer_id: session.customer || '',
        stripe_subscription_id: session.subscription || '',
        checkout_completed_at: new Date().toISOString()
      });

      await handleDomainRegistrationAfterPayment(env, { projectId, userId, session, domainOption });
    }
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    await updateSubscriptionStatus(env, event.data?.object || {});
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data?.object || {};
    const projectId = subscription.metadata?.project_id;
    const userId = subscription.metadata?.user_id || '';
    if (projectId) {
      await updateProjectData(env, projectId, userId, {
        website_subscription_status: 'cancelled',
        stripe_subscription_status: 'cancelled',
        domain_management: subscriptionHasDomainManagement(subscription, env)
          ? { status: 'cancelled', active: false, cancelled_at: new Date().toISOString(), stripe_subscription_id: subscription.id || '' }
          : undefined
      });

      await env.DB
        .prepare(`UPDATE projects SET billing_status = 'cancelled', published = 0, updated_at = datetime('now') WHERE id = ?`)
        .bind(projectId)
        .run();
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    await updateInvoiceStatus(env, event.data?.object || {}, true);
  }

  if (event.type === 'invoice.payment_failed') {
    await updateInvoiceStatus(env, event.data?.object || {}, false);
  }

  return json({ received: true });
}

export async function onRequestGet() {
  return error('Method not allowed.', 405);
}
