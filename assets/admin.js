(() => {
  const state = {
    tab: 'projects',
    search: '',
    overview: null,
    selectedProjectId: new URLSearchParams(window.location.search).get('project') || ''
  };

  const els = {
    message: document.getElementById('adminMessage'),
    stats: document.getElementById('adminStats'),
    list: document.getElementById('adminList'),
    detail: document.getElementById('adminDetail'),
    search: document.getElementById('adminSearch'),
    refresh: document.getElementById('adminRefreshBtn')
  };

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function showMessage(text, type = 'info') {
    if (!els.message) return;
    els.message.style.display = 'block';
    els.message.className = `notice ${type}`;
    els.message.textContent = text;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed with ${response.status}`);
    return data;
  }

  function parseBodyJson(item) {
    try { return typeof item?.body_json === 'string' ? JSON.parse(item.body_json || '{}') : (item?.body_json || {}); }
    catch { return {}; }
  }

  function matches(item) {
    const needle = state.search.trim().toLowerCase();
    if (!needle) return true;
    return JSON.stringify(item || {}).toLowerCase().includes(needle);
  }

  function renderStats() {
    const stats = state.overview?.stats || {};
    els.stats.innerHTML = `
      <article class="admin-stat card"><strong>${esc(stats.users || 0)}</strong><span>Users</span></article>
      <article class="admin-stat card"><strong>${esc(stats.projects || 0)}</strong><span>Projects</span></article>
      <article class="admin-stat card"><strong>${esc(stats.published_projects || 0)}</strong><span>Published</span></article>
      <article class="admin-stat card"><strong>${esc(stats.active_billing || 0)}</strong><span>Active billing</span></article>
      <article class="admin-stat card"><strong>${esc(stats.custom_enquiries || 0)}</strong><span>Custom enquiries</span></article>
      <article class="admin-stat card"><strong>${esc(stats.support_requests || 0)}</strong><span>Support requests</span></article>
    `;
  }

  function listItems() {
    if (!state.overview) return [];

    if (state.tab === 'projects') return (state.overview.projects || []).filter(matches);
    if (state.tab === 'enquiries') return (state.overview.enquiries || []).filter(matches);
    if (state.tab === 'support') return (state.overview.support_requests || []).filter(matches);
    if (state.tab === 'users') return (state.overview.users || []).filter(matches);
    return [];
  }

  function projectTitle(project) {
    return project.name || project.business_name || project.data?.business_name || 'Untitled website';
  }

  function renderList() {
    const items = listItems();

    if (!items.length) {
      els.list.innerHTML = '<div class="notice">No items found.</div>';
      return;
    }

    if (state.tab === 'projects') {
      els.list.innerHTML = items.map((project) => `
        <button class="admin-list-item ${project.id === state.selectedProjectId ? 'active' : ''}" data-project-id="${esc(project.id)}" type="button">
          <strong>${esc(projectTitle(project))}</strong>
          <span>${esc(project.user_email || 'No email')} • ${esc(project.billing_status || 'no billing')}</span>
          <small>${Number(project.published) === 1 ? 'Published' : 'Draft'} • ${esc(project.domain_option || 'pbi_subdomain')}</small>
        </button>
      `).join('');

      els.list.querySelectorAll('[data-project-id]').forEach((button) => {
        button.addEventListener('click', () => loadProject(button.dataset.projectId));
      });
      return;
    }

    if (state.tab === 'enquiries') {
      els.list.innerHTML = items.map((item) => {
        const body = parseBodyJson(item);
        return `
          <button class="admin-list-item" data-enquiry-id="${esc(item.id)}" type="button">
            <strong>${esc(item.business_name || body.business_name || item.contact_name || 'Custom build enquiry')}</strong>
            <span>${esc(item.email || body.email || '')} • ${esc(item.status || 'new')}</span>
            <small>${esc(item.main_promotion_goal || body.main_promotion_goal || 'No promotion goal')}</small>
          </button>
        `;
      }).join('');

      els.list.querySelectorAll('[data-enquiry-id]').forEach((button) => {
        const item = items.find((row) => row.id === button.dataset.enquiryId);
        button.addEventListener('click', () => renderEnquiry(item));
      });
      return;
    }

    if (state.tab === 'support') {
      els.list.innerHTML = items.map((item) => `
        <button class="admin-list-item" data-support-id="${esc(item.id)}" type="button">
          <strong>${esc(item.email || 'Support request')}</strong>
          <span>${esc(item.type || 'support')} • ${esc(item.status || 'new')}</span>
          <small>${esc((item.message || '').slice(0, 90))}</small>
        </button>
      `).join('');

      els.list.querySelectorAll('[data-support-id]').forEach((button) => {
        const item = items.find((row) => row.id === button.dataset.supportId);
        button.addEventListener('click', () => renderSupport(item));
      });
      return;
    }

    if (state.tab === 'users') {
      els.list.innerHTML = items.map((user) => `
        <button class="admin-list-item" data-user-id="${esc(user.id)}" type="button">
          <strong>${esc(user.email)}</strong>
          <span>${esc(user.id)}</span>
          <small>${esc(user.created_at || '')}</small>
        </button>
      `).join('');

      els.list.querySelectorAll('[data-user-id]').forEach((button) => {
        const user = items.find((row) => row.id === button.dataset.userId);
        button.addEventListener('click', () => renderUser(user));
      });
    }
  }

  function pretty(value) {
    return esc(JSON.stringify(value || {}, null, 2));
  }

  async function loadProject(id) {
    state.selectedProjectId = id;
    history.replaceState(null, '', `/admin/?project=${encodeURIComponent(id)}`);
    renderList();
    els.detail.innerHTML = '<div class="notice">Loading project...</div>';

    try {
      const data = await api(`/api/admin/project?id=${encodeURIComponent(id)}`);
      renderProject(data.project, data.related || {});
    } catch (error) {
      els.detail.innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
    }
  }

  function renderProject(project, related) {
    const data = project.data || {};
    const liveUrl = project.public_slug ? `/site/${encodeURIComponent(project.public_slug)}/` : '';
    const domain = data.domain_registration?.name || project.custom_domain || '';
    const supportCount = (related.support_requests || []).length;
    const enquiryCount = (related.custom_enquiries || []).length;

    els.detail.innerHTML = `
      <div class="admin-detail-head">
        <div>
          <p class="eyebrow">Customer project</p>
          <h2>${esc(projectTitle(project))}</h2>
          <p class="muted">${esc(project.user_email || '')}</p>
        </div>
        <div class="admin-action-row">
          <a class="btn" href="/builder/?project=${encodeURIComponent(project.id)}&admin=1">Open builder</a>
          ${liveUrl ? `<a class="btn-ghost" href="${esc(liveUrl)}" target="_blank" rel="noopener">View live site</a>` : ''}
          <button class="btn-ghost" id="adminPublishBtn" type="button">Publish</button>
        </div>
      </div>

      <div class="admin-grid-2">
        <div class="admin-info-card"><strong>Status</strong><span>${esc(project.status || 'draft')}</span></div>
        <div class="admin-info-card"><strong>Billing</strong><span>${esc(project.billing_status || 'not active')}</span></div>
        <div class="admin-info-card"><strong>Plan</strong><span>${esc(project.plan || 'none')}</span></div>
        <div class="admin-info-card"><strong>Domain</strong><span>${esc(domain || project.domain_option || 'PBI subdomain')}</span></div>
        <div class="admin-info-card"><strong>Assisted setup</strong><span>${data.assisted_setup_paid ? 'Paid' : 'Not paid'}</span></div>
        <div class="admin-info-card"><strong>Requests</strong><span>${supportCount} support • ${enquiryCount} custom</span></div>
      </div>

      <section class="admin-control-panel">
        <h3>Quick admin controls</h3>
        <p class="muted">Use these for support tasks without editing raw JSON.</p>
        <div class="admin-quick-grid">
          <button class="btn-ghost" data-admin-action="mark_billing_active" type="button">Mark billing active</button>
          <button class="btn-ghost" data-admin-action="mark_billing_pending" type="button">Mark billing pending</button>
          <button class="btn-ghost" data-admin-action="mark_billing_cancelled" type="button">Mark billing cancelled</button>
          <button class="btn-ghost" data-admin-action="mark_assisted_paid" type="button">Mark assisted paid</button>
          <button class="btn-ghost" data-admin-action="mark_assisted_unpaid" type="button">Mark assisted unpaid</button>
          <button class="btn-ghost" data-admin-action="mark_custom_deposit_paid" type="button">Mark custom deposit paid</button>
          <button class="btn-ghost" data-admin-action="mark_custom_deposit_unpaid" type="button">Mark custom deposit unpaid</button>
          <button class="btn-danger" data-admin-action="delete_project" type="button">Delete project</button>
        </div>

        <div class="admin-grid-2">
          <form id="adminDomainCheckerForm" class="admin-mini-form">
            <h4>Admin domain checker</h4>
            <div class="field"><label>Domain to check</label><input class="input" name="domain" placeholder="example.co.uk"></div>
            <button class="btn-ghost" type="submit">Check domain</button>
            <div id="adminDomainResults" class="admin-domain-results"></div>
          </form>

          <form id="adminStageForm" class="admin-mini-form">
            <h4>Project stage</h4>
            <div class="field">
              <label>Current stage</label>
              <select class="input" name="stage">
                ${['new_enquiry','discovery_email_sent','waiting_for_customer_info','quote_sent','deposit_paid','build_started','first_draft_ready','revisions_in_progress','final_approval','published','handoff_completed'].map((stage) => `<option value="${stage}" ${data.custom_build_stage === stage ? 'selected' : ''}>${stage.replaceAll('_', ' ')}</option>`).join('')}
              </select>
            </div>
            <button class="btn-ghost" type="submit">Save stage</button>
          </form>
        </div>

        <form id="adminChecklistForm" class="admin-mini-form">
          <h4>Missing information checklist</h4>
          <div class="admin-checklist-grid">
            ${[
              ['business_name_confirmed','Business name confirmed'],
              ['contact_details_confirmed','Contact details confirmed'],
              ['logo_received','Logo received'],
              ['images_received','Images received'],
              ['brand_colours_confirmed','Brand colours confirmed'],
              ['pages_confirmed','Pages confirmed'],
              ['services_confirmed','Services/products confirmed'],
              ['domain_confirmed','Domain confirmed'],
              ['seo_basics_completed','SEO basics completed'],
              ['final_approval_received','Final approval received']
            ].map(([key, label]) => `<label class="terms-check"><input type="checkbox" name="${key}" ${data.custom_build_checklist?.[key] ? 'checked' : ''}> <span>${label}</span></label>`).join('')}
          </div>
          <button class="btn-ghost" type="submit">Save checklist</button>
        </form>

        <div class="admin-grid-2">
          <form id="adminDomainStatusForm" class="admin-mini-form">
            <h4>Domain status</h4>
            <div class="field"><label>Status</label><input class="input" name="domain_status" value="${esc(data.domain_registration_status || '')}" placeholder="registered / pending / manual action needed"></div>
            <div class="field"><label>Status note</label><input class="input" name="domain_message" value="${esc(data.domain_registration_message || '')}" placeholder="What should you/customer know?"></div>
            <div class="field"><label>Renewal date</label><input class="input" type="date" name="renewal_date" value="${esc(data.domain_renewal_date || '')}"></div>
            <button class="btn-ghost" type="submit">Save domain status</button>
            <button class="btn-ghost" id="adminSendRenewalBtn" type="button">Send renewal email</button>
          </form>

          <form id="adminEmailCustomerForm" class="admin-mini-form">
            <h4>Email customer</h4>
            <div class="field"><label>Subject</label><input class="input" name="subject" value="Update on your PBI website"></div>
            <div class="field"><label>Message</label><textarea class="input" name="message" placeholder="Write a helpful customer update..."></textarea></div>
            <button class="btn" type="submit">Send email</button>
          </form>
        </div>

        <form id="adminNoteForm" class="admin-mini-form">
          <h4>Admin notes</h4>
          <textarea class="input" name="note" placeholder="Add an internal note about this customer/project..."></textarea>
          <button class="btn-ghost" type="submit">Save note</button>
          <div class="admin-notes-list">
            ${(Array.isArray(data.admin_notes) ? data.admin_notes : []).map((note) => `<div class="admin-note"><strong>${esc(note.by || 'Admin')}</strong><span>${esc(note.created_at || '')}</span><p>${esc(note.note || '')}</p></div>`).join('') || '<p class="muted">No admin notes yet.</p>'}
          </div>
        </form>

        <div class="admin-grid-2">
          <form id="adminTemplateEmailForm" class="admin-mini-form">
            <h4>Email templates</h4>
            <div class="field">
              <label>Template</label>
              <select class="input" name="template">
                <option value="first_response">First response</option>
                <option value="missing_info">Missing information request</option>
                <option value="quote_ready">Quote ready</option>
                <option value="first_draft">First draft ready</option>
                <option value="final_approval">Final approval request</option>
                <option value="website_live">Website live</option>
              </select>
            </div>
            <div class="field"><label>Optional extra message</label><textarea class="input" name="message" placeholder="Optional note to add to the template..."></textarea></div>
            <button class="btn" type="submit">Send template email</button>
          </form>

          <form id="adminQuoteForm" class="admin-mini-form">
            <h4>Simple quote builder</h4>
            <div class="field"><label>Base custom build</label><input class="input" type="number" name="base" value="${esc(data.custom_build_quote?.items?.[0]?.amount || 750)}"></div>
            <div class="field"><label>Extra pages/features</label><input class="input" type="number" name="extras" value="${esc(data.custom_build_quote?.items?.[1]?.amount || 0)}"></div>
            <div class="field"><label>Deposit</label><input class="input" type="number" name="deposit" value="${esc(data.custom_build_quote?.deposit || 500)}"></div>
            <div class="field"><label>Notes</label><textarea class="input" name="notes" placeholder="Scope notes...">${esc(data.custom_build_quote?.notes || '')}</textarea></div>
            <button class="btn-ghost" type="submit">Save quote</button>
            ${data.custom_build_quote ? `<p class="muted"><strong>Saved quote:</strong> ${esc(data.custom_build_quote.currency || 'GBP')} ${esc(data.custom_build_quote.subtotal || 0)} • Deposit ${esc(data.custom_build_quote.deposit || 0)}</p>` : ''}
          </form>
        </div>
      </section>

      <form id="adminProjectForm" class="admin-edit-form">
        <input type="hidden" name="id" value="${esc(project.id)}">
        <div class="field"><label>Project name</label><input class="input" name="name" value="${esc(project.name || '')}"></div>
        <div class="admin-grid-2">
          <div class="field"><label>Status</label><input class="input" name="status" value="${esc(project.status || '')}"></div>
          <div class="field"><label>Billing status</label><input class="input" name="billing_status" value="${esc(project.billing_status || '')}" placeholder="active / pending / setup_required"></div>
          <div class="field"><label>Plan</label><input class="input" name="plan" value="${esc(project.plan || '')}"></div>
          <div class="field"><label>Domain option</label><input class="input" name="domain_option" value="${esc(project.domain_option || data.domain_option || 'pbi_subdomain')}"></div>
          <div class="field"><label>Custom domain</label><input class="input" name="custom_domain" value="${esc(project.custom_domain || data.custom_domain || '')}"></div>
          <div class="field"><label>Public slug</label><input class="input" name="public_slug" value="${esc(project.public_slug || '')}"></div>
        </div>
        <label class="terms-check"><input type="checkbox" name="published" ${Number(project.published) === 1 ? 'checked' : ''}> <span>Mark as published</span></label>
        <div class="field"><label>Project JSON / builder data</label><textarea class="input admin-json-box" name="data_json">${pretty(data)}</textarea></div>
        <div class="row"><button class="btn" type="submit">Save admin changes</button><button class="btn-ghost" id="copyProjectJsonBtn" type="button">Copy JSON</button></div>
      </form>

      <details class="admin-raw-details">
        <summary>Related records</summary>
        <pre>${pretty(related)}</pre>
      </details>
    `;

    document.getElementById('adminProjectForm')?.addEventListener('submit', saveProject);
    document.getElementById('adminPublishBtn')?.addEventListener('click', () => publishProject(project.id));
    document.getElementById('copyProjectJsonBtn')?.addEventListener('click', async () => {
      const box = document.querySelector('[name="data_json"]');
      try { await navigator.clipboard.writeText(box.value); showMessage('Project JSON copied.', 'success'); }
      catch { showMessage('Could not copy JSON.', 'error'); }
    });

    document.querySelectorAll('[data-admin-action]').forEach((button) => {
      button.addEventListener('click', () => runProjectAction(project.id, button.dataset.adminAction));
    });

    document.getElementById('adminDomainStatusForm')?.addEventListener('submit', (event) => saveDomainStatus(event, project.id));
    document.getElementById('adminSendRenewalBtn')?.addEventListener('click', () => sendDomainRenewal(project.id));
    document.getElementById('adminEmailCustomerForm')?.addEventListener('submit', (event) => sendCustomerEmail(event, project.id));
    document.getElementById('adminNoteForm')?.addEventListener('submit', (event) => saveAdminNote(event, project.id));
    document.getElementById('adminDomainCheckerForm')?.addEventListener('submit', (event) => checkAdminDomain(event, project.id));
    document.getElementById('adminStageForm')?.addEventListener('submit', (event) => saveProjectStage(event, project.id));
    document.getElementById('adminChecklistForm')?.addEventListener('submit', (event) => saveProjectChecklist(event, project.id));
    document.getElementById('adminTemplateEmailForm')?.addEventListener('submit', (event) => sendTemplateEmail(event, project.id));
    document.getElementById('adminQuoteForm')?.addEventListener('submit', (event) => saveQuote(event, project.id));
  }

  async function saveProject(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);

    try {
      JSON.parse(fd.get('data_json') || '{}');
    } catch {
      showMessage('Project JSON is invalid. Fix it before saving.', 'error');
      return;
    }

    try {
      const data = await api('/api/admin/project', {
        method: 'POST',
        body: JSON.stringify({
          id: fd.get('id'),
          name: fd.get('name'),
          status: fd.get('status'),
          billing_status: fd.get('billing_status'),
          plan: fd.get('plan'),
          domain_option: fd.get('domain_option'),
          custom_domain: fd.get('custom_domain'),
          public_slug: fd.get('public_slug'),
          published: fd.get('published') === 'on',
          data_json: fd.get('data_json')
        })
      });

      showMessage('Project updated.', 'success');
      await loadOverview(false);
      renderProject(data.project, {});
    } catch (error) {
      showMessage(error.message || 'Could not save project.', 'error');
    }
  }

  async function publishProject(id) {
    try {
      const data = await api('/api/admin/publish', {
        method: 'POST',
        body: JSON.stringify({ project_id: id })
      });
      showMessage(`Published: ${data.live_url}`, 'success');
      await loadOverview(false);
      await loadProject(id);
    } catch (error) {
      showMessage(error.message || 'Could not publish project.', 'error');
    }
  }


  async function runProjectAction(projectId, action) {
    if (action === 'delete_project' && !confirm('Delete this project? This cannot be undone. Stripe billing must still be cancelled separately if needed.')) return;

    try {
      await api('/api/admin/actions', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, action })
      });

      showMessage('Admin action completed.', 'success');

      if (action === 'delete_project') {
        state.selectedProjectId = '';
        history.replaceState(null, '', '/admin/');
        await loadOverview();
        els.detail.innerHTML = '<h2>Project deleted</h2><p class="muted">Select another item from the list.</p>';
        return;
      }

      await loadOverview(false);
      await loadProject(projectId);
    } catch (error) {
      showMessage(error.message || 'Admin action failed.', 'error');
    }
  }

  async function saveDomainStatus(event, projectId) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    try {
      await api('/api/admin/actions', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          action: 'set_domain_status',
          domain_status: fd.get('domain_status'),
          domain_message: fd.get('domain_message'),
          renewal_date: fd.get('renewal_date')
        })
      });

      showMessage('Domain status saved.', 'success');
      await loadProject(projectId);
    } catch (error) {
      showMessage(error.message || 'Could not save domain status.', 'error');
    }
  }

  async function sendDomainRenewal(projectId) {
    const form = document.getElementById('adminDomainStatusForm');
    const fd = new FormData(form);

    try {
      await api('/api/admin/actions', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          action: 'send_domain_renewal',
          domain_name: document.querySelector('[name="custom_domain"]')?.value || '',
          renewal_date: fd.get('renewal_date')
        })
      });

      showMessage('Domain renewal email sent.', 'success');
      await loadProject(projectId);
    } catch (error) {
      showMessage(error.message || 'Could not send renewal email.', 'error');
    }
  }

  async function sendCustomerEmail(event, projectId) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    try {
      await api('/api/admin/actions', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          action: 'send_customer_email',
          subject: fd.get('subject'),
          message: fd.get('message')
        })
      });

      event.currentTarget.reset();
      showMessage('Customer email sent.', 'success');
    } catch (error) {
      showMessage(error.message || 'Could not send customer email.', 'error');
    }
  }

  async function saveAdminNote(event, projectId) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    try {
      await api('/api/admin/actions', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          action: 'save_admin_note',
          note: fd.get('note')
        })
      });

      showMessage('Admin note saved.', 'success');
      await loadProject(projectId);
    } catch (error) {
      showMessage(error.message || 'Could not save note.', 'error');
    }
  }

  function renderEnquiry(item) {
    const body = parseBodyJson(item);
    els.detail.innerHTML = `
      <p class="eyebrow">Custom build enquiry</p>
      <h2>${esc(item.business_name || body.business_name || item.contact_name || 'Custom build enquiry')}</h2>
      <div class="admin-grid-2">
        <div class="admin-info-card"><strong>Name</strong><span>${esc(item.contact_name || body.contact_name || body.name || '')}</span></div>
        <div class="admin-info-card"><strong>Email</strong><span>${esc(item.email || body.email || '')}</span></div>
        <div class="admin-info-card"><strong>Phone</strong><span>${esc(item.phone || body.phone || '')}</span></div>
        <div class="admin-info-card"><strong>Status</strong><span>${esc(item.status || 'new')}</span></div>
        <div class="admin-info-card"><strong>Main promotion goal</strong><span>${esc(item.main_promotion_goal || body.main_promotion_goal || '')}</span></div>
        <div class="admin-info-card"><strong>Project ID</strong><span>${esc(item.project_id || body.project_id || '')}</span></div>
      </div>
      <div class="admin-action-row">
        ${item.project_id ? `<button class="btn" data-open-project="${esc(item.project_id)}" type="button">Open linked project</button>` : ''}
        <a class="btn-ghost" href="mailto:${esc(item.email || body.email || '')}">Email customer</a>
        <button class="btn-ghost" id="markEnquiryReviewedBtn" type="button">Mark reviewed</button>
      </div>
      <details open class="admin-raw-details"><summary>Full enquiry</summary><pre>${pretty(body)}</pre></details>
    `;

    document.querySelector('[data-open-project]')?.addEventListener('click', (event) => loadProject(event.currentTarget.dataset.openProject));
    document.getElementById('markEnquiryReviewedBtn')?.addEventListener('click', () => markMessage('custom_enquiry', item.id, 'reviewed'));
  }

  function renderSupport(item) {
    const body = parseBodyJson(item);
    els.detail.innerHTML = `
      <p class="eyebrow">Assisted setup / support</p>
      <h2>${esc(item.email || 'Support request')}</h2>
      <div class="admin-grid-2">
        <div class="admin-info-card"><strong>Status</strong><span>${esc(item.status || 'new')}</span></div>
        <div class="admin-info-card"><strong>Type</strong><span>${esc(item.type || 'support')}</span></div>
        <div class="admin-info-card"><strong>Project ID</strong><span>${esc(item.project_id || '')}</span></div>
        <div class="admin-info-card"><strong>Created</strong><span>${esc(item.created_at || '')}</span></div>
      </div>
      <div class="admin-message-box">${esc(item.message || '')}</div>
      <div class="admin-action-row">
        ${item.project_id ? `<button class="btn" data-open-project="${esc(item.project_id)}" type="button">Open project</button>` : ''}
        <a class="btn-ghost" href="mailto:${esc(item.email || '')}">Email customer</a>
        <button class="btn-ghost" id="markSupportDoneBtn" type="button">Mark done</button>
      </div>
      <details class="admin-raw-details"><summary>Support JSON</summary><pre>${pretty(body)}</pre></details>
    `;

    document.querySelector('[data-open-project]')?.addEventListener('click', (event) => loadProject(event.currentTarget.dataset.openProject));
    document.getElementById('markSupportDoneBtn')?.addEventListener('click', () => markMessage('support_request', item.id, 'done'));
  }

  function renderUser(user) {
    const projects = (state.overview?.projects || []).filter((project) => project.user_id === user.id);
    els.detail.innerHTML = `
      <p class="eyebrow">Customer account</p>
      <h2>${esc(user.email)}</h2>
      <p class="muted">User ID: ${esc(user.id)}</p>
      <h3>Projects</h3>
      <div class="admin-list">
        ${projects.length ? projects.map((project) => `<button class="admin-list-item" data-open-project="${esc(project.id)}" type="button"><strong>${esc(projectTitle(project))}</strong><span>${esc(project.billing_status || 'no billing')}</span></button>`).join('') : '<div class="notice">No projects found for this user.</div>'}
      </div>
    `;
    els.detail.querySelectorAll('[data-open-project]').forEach((button) => button.addEventListener('click', () => loadProject(button.dataset.openProject)));
  }

  async function markMessage(type, id, status) {
    try {
      await api('/api/admin/message', {
        method: 'POST',
        body: JSON.stringify({ type, id, status })
      });
      showMessage('Status updated.', 'success');
      await loadOverview();
    } catch (error) {
      showMessage(error.message || 'Could not update status.', 'error');
    }
  }

  async function loadOverview(shouldRenderDetail = true) {
    try {
      state.overview = await api('/api/admin/overview');
      renderStats();
      renderList();

      if (shouldRenderDetail && state.selectedProjectId) {
        await loadProject(state.selectedProjectId);
      }
    } catch (error) {
      showMessage(error.message || 'Could not load admin panel.', 'error');
      els.stats.innerHTML = `<div class="card notice error">${esc(error.message || 'Could not load admin panel.')}</div>`;
    }
  }

  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-admin-tab]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      state.tab = button.dataset.adminTab;
      renderList();
      els.detail.innerHTML = '<h2>Select an item</h2><p class="muted">Choose an item from the list.</p>';
    });
  });

  els.search?.addEventListener('input', () => {
    state.search = els.search.value || '';
    renderList();
  });

  els.refresh?.addEventListener('click', () => loadOverview());


  document.getElementById('adminCreateProjectForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    try {
      const data = await api('/api/admin/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_project_for_user',
          email: fd.get('email'),
          name: fd.get('name')
        })
      });

      event.currentTarget.reset();
      showMessage('Project created for customer.', 'success');
      await loadOverview(false);
      if (data.project_id) await loadProject(data.project_id);
    } catch (error) {
      showMessage(error.message || 'Could not create customer project.', 'error');
    }
  });

  loadOverview();
})();
