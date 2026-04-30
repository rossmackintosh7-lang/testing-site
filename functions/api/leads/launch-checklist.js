import { json, error } from '../../_lib/json.js';
import { sendEmail, escapeHtml, publicBaseUrl } from '../../_lib/email.js';

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

export async function onRequestPost({ request, env }) {
  const body = await readBody(request);
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return error('Enter a valid email address.', 400);

  const baseUrl = publicBaseUrl(request, env);
  const checklist = `Website launch checklist:
1. Business name and contact details are correct
2. Main services/products are clear
3. Homepage explains what you do
4. Images are clear and relevant
5. Mobile view has been checked
6. Domain choice is confirmed
7. Page title and Google description are written
8. Contact button works
9. Legal/policy pages are linked if needed
10. Final proofread completed`;

  try {
    await sendEmail(env, {
      to: email,
      subject: 'Your PBI website launch checklist',
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:680px"><h2>Your website launch checklist</h2><p>Hi ${escapeHtml(name || 'there')},</p><p>Here is your simple website launch checklist:</p><ol><li>Business name and contact details are correct</li><li>Main services/products are clear</li><li>Homepage explains what you do</li><li>Images are clear and relevant</li><li>Mobile view has been checked</li><li>Domain choice is confirmed</li><li>Page title and Google description are written</li><li>Contact button works</li><li>Legal/policy pages are linked if needed</li><li>Final proofread completed</li></ol><p><a href="${baseUrl}/signup/" style="display:inline-block;background:#b85f32;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Start building with PBI</a></p></div>`,
      text: checklist
    });
  } catch (err) {
    console.error('Checklist email failed', err);
  }

  if (env.CUSTOM_BUILD_NOTIFY_TO) {
    try {
      await sendEmail(env, {
        to: env.CUSTOM_BUILD_NOTIFY_TO,
        subject: 'New PBI launch checklist lead',
        html: `<p><strong>Name:</strong> ${escapeHtml(name || 'Not provided')}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
        text: `New launch checklist lead\nName: ${name || 'Not provided'}\nEmail: ${email}`
      });
    } catch {}
  }

  return json({ ok: true, message: 'Checklist sent.' });
}
