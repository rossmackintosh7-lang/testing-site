import { json, error, readBody, requireAdmin, parseProjectData, safeJson, ensureAdminTables, slugify } from './_shared.js';
import { sendEmail, escapeHtml, formatMultiline, publicBaseUrl } from '../../_lib/email.js';

async function loadProject(env, id) {
  return await env.DB.prepare(`
    SELECT projects.*, users.email AS user_email
    FROM projects
    LEFT JOIN users ON users.id = projects.user_id
    WHERE projects.id = ?
    LIMIT 1
  `).bind(id).first();
}

async function saveProjectData(env, project, data, extraSql = {}) {
  const fields = ['data_json = ?', 'updated_at = datetime(\'now\')'];
  const values = [safeJson(data)];

  for (const [key, value] of Object.entries(extraSql)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  values.push(project.id);

  await env.DB.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

function appendAdminNote(data, note, adminEmail) {
  const notes = Array.isArray(data.admin_notes) ? data.admin_notes : [];
  notes.unshift({
    id: crypto.randomUUID(),
    note,
    by: adminEmail,
    created_at: new Date().toISOString()
  });
  data.admin_notes = notes.slice(0, 50);
  return data;
}

async function deleteProject(env, id) {
  await ensureAdminTables(env);
  try { await env.DB.prepare(`DELETE FROM domains WHERE project_id = ?`).bind(id).run(); } catch {}
  try { await env.DB.prepare(`DELETE FROM publishes WHERE project_id = ?`).bind(id).run(); } catch {}
  try { await env.DB.prepare(`DELETE FROM support_requests WHERE project_id = ?`).bind(id).run(); } catch {}
  try { await env.DB.prepare(`DELETE FROM custom_build_enquiries WHERE project_id = ?`).bind(id).run(); } catch {}
  await env.DB.prepare(`DELETE FROM projects WHERE id = ?`).bind(id).run();
}

async function createProjectForUser(env, body) {
  const email = String(body.email || body.user_email || '').trim().toLowerCase();
  const name = String(body.name || body.project_name || 'New customer website').trim().slice(0, 140);

  if (!email) return error('Customer email is required.', 400);

  const user = await env.DB.prepare(`SELECT id, email FROM users WHERE email = ? LIMIT 1`).bind(email).first();
  if (!user) return error('That customer account does not exist yet. Ask them to sign up first, then create the project here.', 404);

  const projectId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO projects (id, user_id, name, status, data_json, created_at, updated_at)
    VALUES (?, ?, ?, 'draft', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(projectId, user.id, name).run();

  return json({ ok: true, project_id: projectId, message: 'Project created for customer.' });
}

async function sendCustomerEmail(env, request, project, subject, message, adminEmail) {
  const to = project.user_email;
  if (!to) return error('This project has no customer email.', 400);
  if (!subject || !message) return error('Subject and message are required.', 400);

  const baseUrl = publicBaseUrl(request, env);
  const projectLink = `${baseUrl}/builder/?project=${encodeURIComponent(project.id)}`;
  const dashboardLink = `${baseUrl}/dashboard/`;

  const result = await sendEmail(env, {
    to,
    replyTo: env.CUSTOM_BUILD_NOTIFY_TO || adminEmail,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:680px">
        <h2>${escapeHtml(subject)}</h2>
        <p>${formatMultiline(message)}</p>
        <p><a href="${projectLink}" style="display:inline-block;background:#b85f32;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open your project</a></p>
        <p><a href="${dashboardLink}">Open your PBI dashboard</a></p>
        <hr>
        <p style="font-size:13px;color:#666">Sent by Purbeck Business Innovations.</p>
      </div>
    `,
    text: `${message}\n\nOpen your project: ${projectLink}\nDashboard: ${dashboardLink}`
  });

  if (!result.ok) return error('Email could not be sent.', 500, { resendError: result.error });
  return json({ ok: true, message: 'Customer email sent.' });
}

async function sendRenewalEmail(env, request, project, body, adminEmail) {
  const data = parseProjectData(project);
  const domainName = String(body.domain_name || data.domain_registration?.name || project.custom_domain || data.custom_domain || '').trim();
  const renewalDate = String(body.renewal_date || data.domain_renewal_date || '').trim();
  const to = project.user_email;

  if (!to) return error('This project has no customer email.', 400);
  if (!domainName) return error('Domain name is required.', 400);

  const baseUrl = publicBaseUrl(request, env);
  const subject = `Domain renewal reminder: ${domainName}`;

  const result = await sendEmail(env, {
    to,
    replyTo: env.CUSTOM_BUILD_NOTIFY_TO || adminEmail,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:680px">
        <h2>Your domain renewal is coming up</h2>
        <p>This is a reminder that your domain <strong>${escapeHtml(domainName)}</strong>${renewalDate ? ` is due for renewal on <strong>${escapeHtml(renewalDate)}</strong>` : ' is due for renewal soon'}.</p>
        <p>To avoid disruption to your website or email, please make sure the renewal is paid before the renewal date.</p>
        <p><a href="${baseUrl}/dashboard/" style="display:inline-block;background:#b85f32;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open your dashboard</a></p>
        <p style="font-size:13px;color:#666">If you have already dealt with this, no further action is needed.</p>
      </div>
    `,
    text: `Your domain ${domainName}${renewalDate ? ` is due for renewal on ${renewalDate}` : ' is due for renewal soon'}. Open your dashboard: ${baseUrl}/dashboard/`
  });

  if (!result.ok) return error('Renewal email could not be sent.', 500, { resendError: result.error });

  data.domain_renewal_date = renewalDate || data.domain_renewal_date || '';
  data.domain_renewal_last_reminder_sent_at = new Date().toISOString();
  await saveProjectData(env, project, data);

  return json({ ok: true, message: 'Domain renewal email sent.' });
}

export async function onRequestPost({ request, env }) {
  const { admin, response } = await requireAdmin(env, request);
  if (response) return response;
  if (!env.DB) return error('Database binding missing.', 500);

  const body = await readBody(request);
  const action = String(body.action || '').trim();

  if (action === 'create_project_for_user') {
    return await createProjectForUser(env, body);
  }

  const id = String(body.project_id || body.id || '').trim();
  if (!id) return error('Missing project id.', 400);

  const project = await loadProject(env, id);
  if (!project) return error('Project not found.', 404);

  let data = parseProjectData(project);

  if (action === 'delete_project') {
    await deleteProject(env, id);
    return json({ ok: true, deleted: true });
  }

  if (action === 'mark_billing_active') {
    await env.DB.prepare(`UPDATE projects SET billing_status = 'active', updated_at = datetime('now') WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }

  if (action === 'mark_billing_pending') {
    await env.DB.prepare(`UPDATE projects SET billing_status = 'pending', updated_at = datetime('now') WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }

  if (action === 'mark_billing_cancelled') {
    await env.DB.prepare(`UPDATE projects SET billing_status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }

  if (action === 'mark_assisted_paid') {
    data.assisted_setup_paid = true;
    data.assisted_setup_paid_at = data.assisted_setup_paid_at || new Date().toISOString();
    await saveProjectData(env, project, data);
    return json({ ok: true });
  }

  if (action === 'mark_assisted_unpaid') {
    data.assisted_setup_paid = false;
    await saveProjectData(env, project, data);
    return json({ ok: true });
  }

  if (action === 'mark_custom_deposit_paid') {
    data.custom_build_deposit_paid = true;
    data.custom_build_deposit_paid_at = data.custom_build_deposit_paid_at || new Date().toISOString();
    await saveProjectData(env, project, data, { billing_status: 'custom_build_deposit_paid' });
    return json({ ok: true });
  }

  if (action === 'mark_custom_deposit_unpaid') {
    data.custom_build_deposit_paid = false;
    await saveProjectData(env, project, data);
    return json({ ok: true });
  }

  if (action === 'set_domain_status') {
    data.domain_registration_status = String(body.domain_status || '').trim().slice(0, 80);
    data.domain_registration_message = String(body.domain_message || '').trim().slice(0, 300);
    data.domain_renewal_date = String(body.renewal_date || data.domain_renewal_date || '').trim().slice(0, 40);
    await saveProjectData(env, project, data);
    return json({ ok: true });
  }

  if (action === 'save_admin_note') {
    const note = String(body.note || '').trim();
    if (!note) return error('Note is required.', 400);
    data = appendAdminNote(data, note, admin.email);
    await saveProjectData(env, project, data);
    return json({ ok: true, notes: data.admin_notes || [] });
  }

  if (action === 'send_customer_email') {
    return await sendCustomerEmail(env, request, project, String(body.subject || '').trim(), String(body.message || '').trim(), admin.email);
  }

  if (action === 'send_domain_renewal') {
    return await sendRenewalEmail(env, request, project, body, admin.email);
  }

  if (action === 'set_public_slug') {
    const publicSlug = slugify(body.public_slug || data.subdomain_slug || data.business_name || project.name || 'website');
    await env.DB.prepare(`UPDATE projects SET public_slug = ?, updated_at = datetime('now') WHERE id = ?`).bind(publicSlug, id).run();
    return json({ ok: true, public_slug: publicSlug });
  }


  if (action === 'check_domain') {
    const rawDomain = String(body.domain || body.domain_name || '').trim().toLowerCase();
    const domain = rawDomain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .replace(/[^a-z0-9.-]/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\.+|\.+$/g, '');

    if (!domain || !domain.includes('.')) return error('Enter a valid domain, for example example.co.uk.', 400);
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
      return error('Cloudflare domain checking is not configured. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.', 500);
    }

    const checkOne = async (name) => {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/registrar/domain-check`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domains: [name] })
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.success === false) {
        return { name, available: false, registrable: false, message: result.errors?.map((item) => item.message).join(', ') || `Cloudflare check failed with status ${res.status}` };
      }

      const domainResult = result.result?.domains?.[0] || result.result?.[0] || {};
      return {
        name,
        available: Boolean(domainResult.available ?? domainResult.is_available ?? false),
        registrable: domainResult.registrable !== false,
        premium: Boolean(domainResult.premium || false),
        pricing: domainResult.pricing || {},
        message: domainResult.reason || domainResult.status || ''
      };
    };

    const base = domain.split('.')[0].replace(/[^a-z0-9-]/g, '');
    const tlds = ['co.uk', 'com', 'co', 'net', 'org', 'uk', 'biz', 'info', 'online'];
    const requested = await checkOne(domain);
    const suggestionNames = Array.from(new Set(tlds.map((tld) => `${base}.${tld}`).filter((name) => name !== domain))).slice(0, 8);
    const suggestionsRaw = await Promise.all(suggestionNames.map(checkOne));
    const suggestions = suggestionsRaw.filter((item) => item.available && item.registrable !== false).slice(0, 6);

    return json({ ok: true, requested, suggestions });
  }

  if (action === 'select_domain_for_project') {
    const domainName = String(body.domain_name || '').trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .replace(/[^a-z0-9.-]/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\.+|\.+$/g, '');

    if (!domainName || !domainName.includes('.')) return error('Valid domain name is required.', 400);

    data.domain_registration = {
      ...(data.domain_registration || {}),
      name: domainName,
      available: body.available !== false,
      registrable: body.registrable !== false,
      selected_by_admin: true,
      selected_at: new Date().toISOString()
    };
    data.custom_domain = domainName;
    data.domain_option = 'register_new';
    data.domain_registration_status = data.domain_registration_status || 'selected_by_admin';

    await saveProjectData(env, project, data, { domain_option: 'register_new', custom_domain: domainName });
    return json({ ok: true, domain_name: domainName });
  }

  if (action === 'update_project_stage') {
    data.custom_build_stage = String(body.stage || '').trim().slice(0, 80);
    data.custom_build_stage_updated_at = new Date().toISOString();
    await saveProjectData(env, project, data);
    return json({ ok: true, stage: data.custom_build_stage });
  }

  if (action === 'update_project_checklist') {
    const checklist = body.checklist && typeof body.checklist === 'object' ? body.checklist : {};
    data.custom_build_checklist = checklist;
    data.custom_build_checklist_updated_at = new Date().toISOString();
    await saveProjectData(env, project, data);
    return json({ ok: true, checklist });
  }

  if (action === 'save_quote') {
    const quote = body.quote && typeof body.quote === 'object' ? body.quote : {};
    const items = Array.isArray(quote.items) ? quote.items.slice(0, 30) : [];
    const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    data.custom_build_quote = {
      id: crypto.randomUUID(),
      status: quote.status || 'draft',
      currency: quote.currency || 'GBP',
      items,
      subtotal: total,
      deposit: Number(quote.deposit || 500),
      notes: String(quote.notes || '').slice(0, 2000),
      saved_at: new Date().toISOString(),
      saved_by: admin.email
    };

    await saveProjectData(env, project, data);
    return json({ ok: true, quote: data.custom_build_quote });
  }

  if (action === 'send_template_email') {
    const template = String(body.template || '').trim();
    const extraMessage = String(body.message || '').trim();
    const to = project.user_email;
    if (!to) return error('This project has no customer email.', 400);

    const baseUrl = publicBaseUrl(request, env);
    const businessName = data.business_name || project.name || 'your website';
    const projectLink = `${baseUrl}/builder/?project=${encodeURIComponent(project.id)}`;
    const dashboardLink = `${baseUrl}/dashboard/`;

    const templates = {
      first_response: {
        subject: 'Thanks for your custom build enquiry',
        message: `Hi,\n\nThanks for sending your custom build enquiry for ${businessName}.\n\nI’ve received the details and I’m going to review the scope, pages, features, domain requirements and any content you’ve already provided.\n\nThe next step is for me to confirm anything missing and, if needed, arrange a short discovery call so I can make sure the quote and build plan are accurate.\n\nI’ll come back to you with a clear next step rather than rushing you into something that does not fit properly.\n\nKind regards,\nRoss\nPurbeck Business Innovations`
      },
      missing_info: {
        subject: 'A few details needed for your website',
        message: `Hi,\n\nI’m just reviewing your website project and need a few details before I can move it forward properly.\n\nPlease send over anything you have for:\n\n• Logo or brand files\n• Preferred colours\n• Photos/images\n• List of pages needed\n• Services/products to include\n• Contact details\n• Domain preference\n\nOnce I have those, I can tighten the scope and move the project to the next stage.\n\nKind regards,\nRoss\nPurbeck Business Innovations`
      },
      quote_ready: {
        subject: 'Your PBI website quote is ready',
        message: `Hi,\n\nI’ve reviewed your website requirements and prepared the scope/quote for your custom build.\n\nThe quote covers the agreed pages, main features, setup requirements and the next steps for moving into the build stage.\n\nOnce you’re happy with the scope, the next step is the deposit/payment stage so I can reserve the build slot and begin the work.\n\nKind regards,\nRoss\nPurbeck Business Innovations`
      },
      first_draft: {
        subject: 'Your first website draft is ready to review',
        message: `Hi,\n\nYour first website draft is ready for review.\n\nPlease go through the pages and check wording, layout, images, contact details and anything you would like adjusted.\n\nThe best feedback is specific, for example: “change this heading”, “replace this photo”, or “move this section lower”.\n\nKind regards,\nRoss\nPurbeck Business Innovations`
      },
      final_approval: {
        subject: 'Final approval needed before launch',
        message: `Hi,\n\nYour website is now at the final approval stage.\n\nPlease check the content, contact details, links, mobile view, domain details and any legal/business information carefully.\n\nOnce you confirm approval, I can move the site into launch/handoff.\n\nKind regards,\nRoss\nPurbeck Business Innovations`
      },
      website_live: {
        subject: 'Your website is live',
        message: `Hi,\n\nYour website is now live.\n\nYou can access your dashboard here:\n${dashboardLink}\n\nYour project can be edited here:\n${projectLink}\n\nI recommend checking the live site on both mobile and desktop, then letting me know if anything urgent needs adjusting.\n\nKind regards,\nRoss\nPurbeck Business Innovations`
      }
    };

    const picked = templates[template];
    if (!picked) return error('Unknown email template.', 400);

    const finalMessage = extraMessage ? `${picked.message}\n\n${extraMessage}` : picked.message;

    const result = await sendEmail(env, {
      to,
      replyTo: env.CUSTOM_BUILD_NOTIFY_TO || admin.email,
      subject: picked.subject,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:680px">
          <h2>${escapeHtml(picked.subject)}</h2>
          <p>${formatMultiline(finalMessage)}</p>
          <p><a href="${dashboardLink}" style="display:inline-block;background:#b85f32;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open your dashboard</a></p>
          <hr>
          <p style="font-size:13px;color:#666">Sent by Purbeck Business Innovations.</p>
        </div>
      `,
      text: finalMessage
    });

    if (!result.ok) return error('Template email could not be sent.', 500, { resendError: result.error });

    data = appendAdminNote(data, `Template email sent: ${picked.subject}`, admin.email);
    await saveProjectData(env, project, data);
    return json({ ok: true, message: 'Template email sent.' });
  }


  return error('Unknown admin action.', 400);
}

export async function onRequestGet() {
  return error('Method not allowed.', 405);
}
