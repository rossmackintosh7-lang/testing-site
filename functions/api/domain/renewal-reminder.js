import { json, error, readBody, getUserFromSession } from '../projects/_shared.js';
import { sendEmail, publicBaseUrl, escapeHtml } from '../../_lib/email.js';

export async function onRequestPost({ request, env }) {
  const user = await getUserFromSession(env, request);
  if (!user) return error('Unauthorized.', 401);

  const body = await readBody(request);
  const projectId = String(body.project_id || '').trim();
  const domainName = String(body.domain_name || '').trim();
  const renewalDate = String(body.renewal_date || '').trim();

  if (!projectId) return error('Missing project id.', 400);
  if (!domainName) return error('Enter a domain name first.', 400);
  if (!renewalDate) return error('Enter a renewal date first.', 400);

  const project = await env.DB.prepare('SELECT id, name FROM projects WHERE id = ? AND user_id = ? LIMIT 1').bind(projectId, user.id).first();
  if (!project) return error('Project not found.', 404);

  const baseUrl = publicBaseUrl(request, env);
  const result = await sendEmail(env, {
    to: user.email,
    subject: `Domain renewal reminder: ${domainName}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:680px"><h2>Your domain renewal is coming up</h2><p>This is a reminder that <strong>${escapeHtml(domainName)}</strong> is due for renewal on <strong>${escapeHtml(renewalDate)}</strong>.</p><p>To avoid disruption to your website or email, please make sure the renewal is paid before the renewal date.</p><p>If PBI is helping manage your domain, contact us if you are unsure what to do next.</p><p><a href="${baseUrl}/dashboard/">Open your PBI dashboard</a></p></div>`,
    text: `Your domain ${domainName} is due for renewal on ${renewalDate}. Please make sure the renewal is paid before the renewal date to avoid disruption. Dashboard: ${baseUrl}/dashboard/`
  });

  if (!result.ok) return error('Could not send domain renewal reminder email.', 500);
  return json({ ok: true, message: 'Domain renewal reminder sent.' });
}

export async function onRequestGet() { return error('Method not allowed.', 405); }
