import { json, error } from '../../_lib/json.js';
import { randomHex, hashPassword } from '../../_lib/crypto.js';
import { verifyTurnstileDetailed } from '../../_lib/turnstile.js';
import { createSession, makeSetCookie } from '../../_lib/session.js';
import { readJson } from '../../_lib/auth.js';
import { sendEmail, publicBaseUrl, escapeHtml } from '../../_lib/email.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return error('Invalid request body.');

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const projectName = String(body.project_name || 'Untitled website').trim();
  const templatePreset = String(body.template_preset || '').trim();
  const token = String(body.turnstileToken || '');
  const termsAccepted = body.terms_accepted === true;
  const termsVersion = String(body.terms_version || '2026-04-28').trim();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return error('Enter a valid email address.');
  if (!password || password.length < 8) return error('Password must be at least 8 characters.');
  if (!termsAccepted) return error('You must accept the Terms and Conditions before creating an account.', 400);
  if (!token) return error('Turnstile token missing.');

  const turnstile = await verifyTurnstileDetailed(env, token, request.headers.get('CF-Connecting-IP') || '');
  if (!ok) return error('Turnstile validation failed.', 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first();
  if (existing) return error('An account with that email already exists.', 409);

  const userId = crypto.randomUUID();
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);

  await env.DB.prepare(`
      INSERT INTO users
      (id, email, password_hash, password_salt, email_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .bind(userId, email, passwordHash, salt)
    .run();

  const projectId = crypto.randomUUID();

  await env.DB.prepare(`
      INSERT INTO projects
      (id, user_id, name, status, data_json, created_at, updated_at)
      VALUES (?, ?, ?, 'draft', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .bind(projectId, userId, projectName || 'Untitled website')
    .run();

  if (templatePreset) {
    await env.DB.prepare(`UPDATE projects SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(JSON.stringify({ template_preset: templatePreset, project_name: projectName || 'Untitled website' }), projectId)
      .run();
  }

  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS terms_acceptances (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        terms_version TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        accepted_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.DB.prepare(`
      INSERT INTO terms_acceptances
      (id, user_id, email, terms_version, ip_address, user_agent, accepted_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
      .bind(
        crypto.randomUUID(),
        userId,
        email,
        termsVersion,
        request.headers.get('CF-Connecting-IP') || '',
        request.headers.get('User-Agent') || ''
      )
      .run();
  } catch (termsError) {
    console.error('Could not record terms acceptance:', termsError);
  }

  const baseUrl = publicBaseUrl(request, env);

  try {
    await sendEmail(env, {
      to: email,
      subject: 'Welcome to Purbeck Business Innovations',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:680px">
          <h2>Welcome to Purbeck Business Innovations</h2>
          <p>Thanks for signing up. Your PBI dashboard is ready and your first website project has been created.</p>
          <p><a href="${baseUrl}/dashboard/" style="display:inline-block;background:#b85f32;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open your dashboard</a></p>
          <hr>
          <h3>Want help setting it up?</h3>
          <p>You can add assisted setup from your dashboard. PBI can help with wording, page structure, layout and setup guidance.</p>
          <p><a href="${baseUrl}/dashboard/">Add assisted setup</a></p>
          <h3>Want PBI to build it for you?</h3>
          <p>If you would rather have a custom website built for you, send a custom build enquiry and we will review the scope.</p>
          <p><a href="${baseUrl}/custom-build/">Request a custom build</a></p>
          <p style="font-size:13px;color:#666">By creating your account you accepted PBI Terms and Conditions version ${escapeHtml(termsVersion)}.</p>
        </div>
      `,
      text: `Welcome to Purbeck Business Innovations. Your dashboard is ready: ${baseUrl}/dashboard/\n\nAssisted setup is available from your dashboard. Custom build enquiries: ${baseUrl}/custom-build/`
    });
  } catch (emailError) {
    console.error('Welcome email failed:', emailError);
  }

  const session = await createSession(env, userId);

  return json({ ok: true, user: { id: userId, email }, project: { id: projectId, name: projectName } }, 200, {
    'Set-Cookie': makeSetCookie('session_id', session.id, 60 * 60 * 24 * 30, true)
  });
}
