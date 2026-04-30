export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatMultiline(value) {
  return escapeHtml(value || '').replace(/\n/g, '<br>');
}

export async function sendEmail(env, { to, from, replyTo, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    return { ok: false, skipped: true, error: 'Missing RESEND_API_KEY' };
  }

  const sender = from || env.CUSTOM_BUILD_NOTIFY_FROM || 'PBI Enquiries <enquiry@purbeckbusinessinnovations.co.uk>';

  const payload = {
    from: sender,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' ')
  };

  if (replyTo) payload.reply_to = replyTo;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: data };
  return { ok: true, data };
}

export function publicBaseUrl(request, env) {
  if (env.PBI_BASE_URL) return String(env.PBI_BASE_URL).replace(/\/$/, '');
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
