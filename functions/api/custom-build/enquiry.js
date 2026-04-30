import { sendEmail, escapeHtml, formatMultiline } from '../../_lib/email.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    const name = clean(body.contact_name || body.name);
    const email = clean(body.email);
    const phone = clean(body.phone);
    const businessName = clean(body.business_name);
    const industry = clean(body.industry);
    const currentWebsite = clean(body.current_website);
    const mainPromotionGoal = clean(body.main_promotion_goal);
    const projectSummary = clean(body.project_summary);
    const likedWebsites = clean(body.liked_websites);
    const dislikedWebsites = clean(body.disliked_websites);
    const featuresNeeded = clean(body.features_needed);
    const pagesNeeded = clean(body.pages_needed);
    const brandColours = clean(body.brand_colours);
    const logoStatus = clean(body.logo_status);
    const logoIdeas = clean(body.logo_ideas);
    const domainOption = clean(body.domain_option);
    const domainName = clean(body.domain_name);
    const domainStatus = clean(body.domain_status);
    const imagesStatus = clean(body.images_status);
    const wordingHelp = clean(body.wording_help);
    const deadline = clean(body.deadline);
    const budget = clean(body.budget);
    const extraNotes = clean(body.extra_notes);
    const projectId = clean(body.project_id);

    if (!name || !email) return json({ success: false, error: 'Please complete your name and email.', receivedFields: Object.keys(body) }, 400);
    if (!isValidEmail(email)) return json({ success: false, error: 'Please enter a valid email address.' }, 400);

    const notifyTo = env.CUSTOM_BUILD_NOTIFY_TO || 'info@purbeckbusinessinnovations.co.uk';
    const subject = `New PBI custom build enquiry from ${name}`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:760px">
        <h2>New PBI Custom Build Enquiry</h2>
        <h3>Contact details</h3>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p>
        <hr>
        <h3>Business details</h3>
        <p><strong>Business name:</strong> ${escapeHtml(businessName || 'Not provided')}</p>
        <p><strong>Industry:</strong> ${escapeHtml(industry || 'Not provided')}</p>
        <p><strong>Current website:</strong> ${escapeHtml(currentWebsite || 'Not provided')}</p>
        <p><strong>Main promotion goal:</strong> ${escapeHtml(mainPromotionGoal || 'Not provided')}</p>
        <hr>
        <h3>Website brief</h3>
        <p><strong>Project summary:</strong><br>${formatMultiline(projectSummary || 'Not provided')}</p>
        <p><strong>Pages needed:</strong><br>${formatMultiline(pagesNeeded || 'Not provided')}</p>
        <p><strong>Features needed:</strong><br>${formatMultiline(featuresNeeded || 'Not provided')}</p>
        <p><strong>Websites they like:</strong><br>${formatMultiline(likedWebsites || 'Not provided')}</p>
        <p><strong>Websites they dislike:</strong><br>${formatMultiline(dislikedWebsites || 'Not provided')}</p>
        <hr>
        <h3>Branding</h3>
        <p><strong>Brand colours:</strong> ${escapeHtml(brandColours || 'Not provided')}</p>
        <p><strong>Logo status:</strong> ${escapeHtml(logoStatus || 'Not provided')}</p>
        <p><strong>Logo ideas:</strong><br>${formatMultiline(logoIdeas || 'Not provided')}</p>
        <hr>
        <h3>Domain</h3>
        <p><strong>Domain option:</strong> ${escapeHtml(domainOption || 'Not provided')}</p>
        <p><strong>Domain name:</strong> ${escapeHtml(domainName || 'Not provided')}</p>
        <p><strong>Domain status:</strong> ${escapeHtml(domainStatus || 'Not provided')}</p>
        <hr>
        <h3>Project details</h3>
        <p><strong>Images status:</strong> ${escapeHtml(imagesStatus || 'Not provided')}</p>
        <p><strong>Wording help:</strong> ${escapeHtml(wordingHelp || 'Not provided')}</p>
        <p><strong>Ideal launch date:</strong> ${escapeHtml(deadline || 'Not provided')}</p>
        <p><strong>Estimated budget:</strong> ${escapeHtml(budget || 'Not provided')}</p>
        <hr>
        <h3>Anything else</h3>
        <p>${formatMultiline(extraNotes || 'Not provided')}</p>
        ${projectId ? `<p><strong>Linked project ID:</strong> ${escapeHtml(projectId)}</p>` : ''}
      </div>
    `;

    const text = `New PBI Custom Build Enquiry\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nBusiness: ${businessName || 'Not provided'}\nIndustry: ${industry || 'Not provided'}\nCurrent website: ${currentWebsite || 'Not provided'}\nMain promotion goal: ${mainPromotionGoal || 'Not provided'}\n\nProject summary:\n${projectSummary || 'Not provided'}\n\nPages needed:\n${pagesNeeded || 'Not provided'}\n\nFeatures needed:\n${featuresNeeded || 'Not provided'}\n\nLiked websites:\n${likedWebsites || 'Not provided'}\n\nDisliked websites:\n${dislikedWebsites || 'Not provided'}\n\nBrand colours: ${brandColours || 'Not provided'}\nLogo status: ${logoStatus || 'Not provided'}\nLogo ideas:\n${logoIdeas || 'Not provided'}\n\nDomain option: ${domainOption || 'Not provided'}\nDomain name: ${domainName || 'Not provided'}\nDomain status: ${domainStatus || 'Not provided'}\n\nImages: ${imagesStatus || 'Not provided'}\nWording help: ${wordingHelp || 'Not provided'}\nDeadline: ${deadline || 'Not provided'}\nBudget: ${budget || 'Not provided'}\n\nAnything else:\n${extraNotes || 'Not provided'}`;


    if (env.DB) {
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS custom_build_enquiries (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            contact_name TEXT,
            email TEXT,
            phone TEXT,
            business_name TEXT,
            main_promotion_goal TEXT,
            status TEXT DEFAULT 'new',
            body_json TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run();

        await env.DB.prepare(`
          INSERT INTO custom_build_enquiries
          (id, project_id, contact_name, email, phone, business_name, main_promotion_goal, status, body_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          crypto.randomUUID(),
          projectId || '',
          name,
          email,
          phone || '',
          businessName || '',
          mainPromotionGoal || '',
          JSON.stringify(body)
        ).run();
      } catch (adminStoreError) {
        console.error('Could not store custom build enquiry for admin panel:', adminStoreError);
      }
    }

    const emailResult = await sendEmail(env, { to: notifyTo, replyTo: email, subject, html, text });
    if (!emailResult.ok) return json({ success: false, error: 'The enquiry could not be sent through Resend.', resendError: emailResult.error }, 500);

    if (projectId && env.DB) {
      try {
        const project = await env.DB.prepare('SELECT data_json FROM projects WHERE id = ? LIMIT 1').bind(projectId).first();
        if (project) {
          let data = {};
          try { data = typeof project.data_json === 'string' ? JSON.parse(project.data_json || '{}') : {}; } catch { data = {}; }
          data.custom_build_enquiry_submitted = true;
          data.custom_build_enquiry_submitted_at = new Date().toISOString();
          data.main_promotion_goal = mainPromotionGoal;
          await env.DB.prepare('UPDATE projects SET data_json = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(JSON.stringify(data), projectId).run();
        }
      } catch (dbError) { console.error('Could not update project after custom enquiry:', dbError); }
    }

    return json({ success: true, message: 'Your enquiry has been sent successfully.', id: emailResult.data?.id || null });
  } catch (error) {
    console.error('Custom build enquiry error:', error);
    return json({ success: false, error: 'Something went wrong while sending your enquiry.' }, 500);
  }
}

export async function onRequestGet() { return json({ success: false, error: 'Method not allowed.' }, 405); }
function clean(value) { if (typeof value !== 'string') return ''; return value.trim(); }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }); }
function corsHeaders() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }; }
