document.addEventListener('DOMContentLoaded', () => {
  const projectList = document.getElementById('projectList');
  const newProjectBtn = document.getElementById('newProjectBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userEmail = document.getElementById('userEmail');
  const dashboardMessage = document.getElementById('dashboardMessage');

  function esc(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function showMessage(text, type = 'info') {
    if (!dashboardMessage) return;
    dashboardMessage.textContent = text;
    dashboardMessage.className = `notice domain-${type}`;
    dashboardMessage.style.display = 'block';
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed with ${response.status}`);
    return data;
  }

  function parseData(project) {
    try { return typeof project.data_json === 'string' ? JSON.parse(project.data_json || '{}') : (project.data_json || {}); }
    catch { return {}; }
  }

  function planLabel(plan) {
    return { starter: 'Starter Launch', business: 'Business Launch', plus: 'Business Plus', free_preview: 'Free preview', custom_build_deposit: 'Custom build deposit' }[plan] || 'Free preview';
  }

  function statusLabel(project) {
    if (Number(project.published || 0) === 1) return 'Published';
    if (project.billing_status === 'active') return 'Paid, ready to publish';
    if (project.billing_status === 'pending') return 'Payment pending';
    if (project.billing_status === 'setup_required') return 'Stripe setup required';
    if (project.billing_status === 'past_due') return 'Payment issue';
    if (project.billing_status === 'cancelled') return 'Cancelled';
    return 'Draft';
  }

  function moneyMinor(amount, currency = 'gbp') {
    const value = Number(amount || 0) / 100;
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: String(currency || 'gbp').toUpperCase() }).format(value);
    } catch {
      return `£${value.toFixed(2)}`;
    }
  }

  function readinessInfo(project, data) {
    const checks = [
      ['Business name', Boolean(data.business_name)],
      ['Homepage heading', Boolean(data.page_main_heading || data.pages?.home?.title)],
      ['Contact page', Array.isArray(data.selected_pages) ? data.selected_pages.includes('contact') : true],
      ['Logo uploaded', Boolean(data.logo_data_url || data.logoDataUrl)],
      ['Images uploaded', Array.isArray(data.gallery_images || data.galleryImages) && (data.gallery_images || data.galleryImages).length > 0],
      ['Domain selected', Boolean(data.domain_registration?.name || data.custom_domain || project.custom_domain || data.subdomain_slug)],
      ['Published', Number(project.published || 0) === 1]
    ];

    const done = checks.filter((item) => item[1]).length;
    const score = Math.round((done / checks.length) * 100);
    const missing = checks.filter((item) => !item[1]).map((item) => item[0]);
    let next = 'Open the builder and continue editing your website.';

    if (!data.business_name) next = 'Add your business name.';
    else if (!data.page_main_heading && !data.pages?.home?.title) next = 'Write your homepage heading.';
    else if (!data.logo_data_url && !data.logoDataUrl) next = 'Upload your logo.';
    else if (!data.domain_registration?.name && !data.custom_domain && !project.custom_domain && !data.subdomain_slug) next = 'Choose your domain option.';
    else if (Number(project.published || 0) !== 1) next = 'Preview your site and publish when ready.';
    else next = 'Your site is live. Next step: improve SEO or share your link.';

    return { score, missing, next };
  }

  function dateLabel(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function render(projects) {
    if (!projects.length) {
      projectList.innerHTML = '<div class="notice">No projects yet. Create your first website to get started.</div>';
      return;
    }

    projectList.innerHTML = projects.map((project) => {
      const data = parseData(project);
      const live = project.public_slug ? `/site/${encodeURIComponent(project.public_slug)}/` : '';
      const assistedPaid = data.assisted_setup_paid === true;
      const customDepositPaid = data.custom_build_deposit_paid === true || project.billing_status === 'custom_build_deposit_paid';
      const domainName = data.custom_domain || project.custom_domain || data.domain_registration?.name || data.subdomain_slug || '';
      const domainStatus = data.domain_registration_status || '';
      const domainMessage = data.domain_registration_message || '';
      const domainManagement = data.domain_management || {};
      const domainManagementActive = domainManagement.active === true || domainManagement.status === 'active';
      const domainFeeLabel = moneyMinor(domainManagement.annual_fee_minor || 1000, domainManagement.currency || 'gbp');
      const nextDomainFeeDate = dateLabel(domainManagement.current_period_end || domainManagement.next_fee_estimate_at);
      const lastDomainFeePaid = dateLabel(domainManagement.last_paid_at);
      const ready = readinessInfo(project, data);

      return `
        <div class="project-row dashboard-project" data-project-id="${esc(project.id)}">
          <a class="project-main" href="/builder/?project=${encodeURIComponent(project.id)}">
            <h3>${esc(project.name || 'Untitled website')}</h3>
            <p class="muted">${esc(statusLabel(project))} • ${esc(planLabel(project.plan))}${project.updated_at ? ` • Updated ${esc(project.updated_at)}` : ''}</p>
            ${Number(project.published || 0) === 1 && live ? `<p class="muted">Live: ${esc(live)}</p>` : ''}
          </a>
          <div class="dashboard-next-step">
            <div><strong>Website readiness: ${ready.score}%</strong><span>${esc(ready.next)}</span></div>
            <div class="readiness-bar"><i style="width:${ready.score}%"></i></div>
          </div>
          <div class="project-actions">
            ${Number(project.published || 0) === 1 && live ? `<a class="btn-ghost" href="${esc(live)}" target="_blank" rel="noopener">View live</a>` : ''}
            <a class="btn-ghost" href="/builder/?project=${encodeURIComponent(project.id)}">Edit</a>
            <a class="btn" href="/payment/?project=${encodeURIComponent(project.id)}">${Number(project.published || 0) === 1 ? 'Manage plan' : 'Publish'}</a>
            <button class="btn-danger projectDeleteBtn" type="button" data-project-id="${esc(project.id)}" data-project-name="${esc(project.name || 'Untitled website')}">Delete</button>
          </div>
          <div class="dashboard-upgrade-grid">
            <div class="dashboard-upgrade-card">
              <p class="eyebrow">Assisted setup</p>
              <h4>${assistedPaid ? 'Assisted setup active' : 'Need a hand setting it up?'}</h4>
              <p class="muted">${assistedPaid ? 'Send a setup request to PBI. Your current project details will be included so we can see what you are working on.' : 'Add assisted setup for <span data-gbp="99" data-price-suffix=" one-off">£99 one-off</span>. PBI can help with wording, page structure, layout and images.'}</p>
              ${assistedPaid ? `
                <form class="assisted-request-form" data-assisted-form="${esc(project.id)}">
                  <textarea class="textarea" name="message" required placeholder="Tell PBI what you need help with on this project."></textarea>
                  <button class="btn" type="submit">Send assisted setup request</button>
                </form>
              ` : `<button class="btn dashboardCheckoutBtn" type="button" data-plan="assisted_setup" data-project-id="${esc(project.id)}">Add assisted setup</button>`}
            </div>
            <div class="dashboard-upgrade-card">
              <p class="eyebrow">Custom build deposit</p>
              <h4>${customDepositPaid ? 'Deposit paid' : 'Secure a custom build slot'}</h4>
              <p class="muted">${customDepositPaid ? 'Your custom build deposit has been marked as paid.' : 'Pay the <span data-gbp="500">£500</span> custom build deposit from your dashboard when you are ready to secure a build slot.'}</p>
              ${customDepositPaid ? '<span class="status-pill">Paid</span>' : `<button class="btn-ghost dashboardCheckoutBtn" type="button" data-plan="custom_build_deposit" data-project-id="${esc(project.id)}">Pay deposit</button>`}
            </div>
            <div class="dashboard-upgrade-card">
              <p class="eyebrow">Domain billing</p>
              <h4>${domainManagementActive ? 'Domain management active' : 'Domain renewal and management'}</h4>
              <p class="muted">${domainManagementActive ? `The ongoing PBI domain fee is linked to this project at ${esc(domainFeeLabel)} per year.` : 'When a new domain is bought through PBI, the annual domain management fee is linked to the same Stripe subscription as the website plan.'}</p>
              ${domainStatus ? `<p class="muted"><strong>Registration status:</strong> ${esc(domainStatus.replaceAll('_', ' '))}${domainMessage ? ` — ${esc(domainMessage)}` : ''}</p>` : ''}
              ${domainManagementActive ? `<p class="muted"><strong>Next estimated domain fee:</strong> ${esc(nextDomainFeeDate || 'Tracked in Stripe')}</p>` : ''}
              ${lastDomainFeePaid ? `<p class="muted"><strong>Last domain fee payment:</strong> ${esc(lastDomainFeePaid)}</p>` : ''}
              <form class="domain-renewal-form" data-renewal-form="${esc(project.id)}">
                <input class="input" name="domain_name" placeholder="Domain name" value="${esc(domainName)}">
                <input class="input" name="renewal_date" type="date">
                <button class="btn-ghost" type="submit">Send renewal email</button>
              </form>
            </div>
          </div>
        </div>
      `;
    }).join('');

    bindProjectActions();
    window.PBICurrency?.apply(projectList);
  }

  function bindProjectActions() {
    document.querySelectorAll('.dashboardCheckoutBtn').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        const oldText = button.textContent;
        button.textContent = 'Preparing checkout...';
        try {
          const data = await api('/api/billing/create-checkout', { method: 'POST', body: JSON.stringify({ project_id: button.dataset.projectId, plan: button.dataset.plan, domain_option: 'pbi_subdomain' }) });
          if (data.url) { window.location.href = data.url; return; }
          showMessage(data.message || 'Checkout could not be started.', data.setup_required ? 'info' : 'error');
        } catch (error) { showMessage(error.message || 'Could not start checkout.', 'error'); }
        finally { button.disabled = false; button.textContent = oldText; }
      });
    });

    document.querySelectorAll('.assisted-request-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const projectId = form.dataset.assistedForm;
        const message = new FormData(form).get('message');
        try {
          await api('/api/assisted-setup/request', { method: 'POST', body: JSON.stringify({ project_id: projectId, message }) });
          form.reset();
          showMessage('Assisted setup request sent to PBI.', 'success');
        } catch (error) { showMessage(error.message || 'Could not send assisted setup request.', 'error'); }
      });
    });

    document.querySelectorAll('.projectDeleteBtn').forEach((button) => {
      button.addEventListener('click', async () => {
        const projectId = button.dataset.projectId;
        const projectName = button.dataset.projectName || 'this project';
        const confirmText = `Delete "${projectName}"? This removes the project from your dashboard. If it has an active Stripe subscription, cancel that in Stripe too.`;

        if (!projectId || !confirm(confirmText)) return;

        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = 'Deleting...';

        try {
          await api('/api/projects/delete', {
            method: 'POST',
            body: JSON.stringify({ project_id: projectId })
          });

          showMessage('Project deleted.', 'success');
          await load();
        } catch (error) {
          showMessage(error.message || 'Could not delete project.', 'error');
          button.disabled = false;
          button.textContent = oldText;
        }
      });
    });

    document.querySelectorAll('.domain-renewal-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const projectId = form.dataset.renewalForm;
        const fd = new FormData(form);
        try {
          await api('/api/domain/renewal-reminder', { method: 'POST', body: JSON.stringify({ project_id: projectId, domain_name: fd.get('domain_name'), renewal_date: fd.get('renewal_date') }) });
          showMessage('Domain renewal reminder email sent.', 'success');
        } catch (error) { showMessage(error.message || 'Could not send domain renewal email.', 'error'); }
      });
    });
  }

  async function load() {
    try {
      const data = await api('/api/projects/list');
      if (data.user?.email && userEmail) userEmail.textContent = data.user.email;
      render(data.projects || []);
    } catch (error) {
      projectList.innerHTML = `<div class="notice domain-error">${esc(error.message || 'Could not load projects.')}</div>`;
    }
  }

  async function create() {
    const name = prompt('Project name:', 'New website');
    if (name === null) return;
    if (newProjectBtn) { newProjectBtn.disabled = true; newProjectBtn.textContent = 'Creating...'; }
    try {
      const data = await api('/api/projects/create', { method: 'POST', body: JSON.stringify({ name: name.trim() || 'New website' }) });
      if (!data.project?.id) throw new Error('Project created but no project id was returned.');
      location.href = `/builder/?project=${encodeURIComponent(data.project.id)}`;
    } catch (error) { alert(error.message || 'Could not create project.'); }
    finally { if (newProjectBtn) { newProjectBtn.disabled = false; newProjectBtn.textContent = 'Create new project'; } }
  }

  async function logout() { try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } finally { location.href = '/login/'; } }

  if (newProjectBtn) newProjectBtn.onclick = create;
  if (logoutBtn) logoutBtn.onclick = logout;
  load();
});
