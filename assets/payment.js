document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('project');
  const success = params.get('success') === '1';
  const cancelled = params.get('cancelled') === '1';
  const message = document.getElementById('paymentMessage');
  const selectedDomainSummary = document.getElementById('selectedDomainSummary');
  let projectData = {};

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function showMessage(text, type = 'info') {
    if (!message) return;
    message.textContent = text;
    message.style.display = 'block';
    message.className = `notice domain-${type}`;
  }

  function selectedDomainOption() {
    return document.querySelector('input[name="domainOption"]:checked')?.value || 'pbi_subdomain';
  }

  function selectedDomainRegistration() {
    return projectData.domain_registration || null;
  }

  function priceLabel(domain) {
    const pricing = domain?.pricing || {};
    const registration = pricing.registration_cost || '';
    const currency = pricing.currency || 'GBP';
    return registration ? `${currency} ${registration} first-year registration, plus annual PBI domain management fee at checkout` : 'Price confirmed at checkout';
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed with ${response.status}`);
    return data;
  }

  function parseProjectData(project) {
    try {
      return typeof project.data_json === 'string' ? JSON.parse(project.data_json || '{}') : (project.data_json || {});
    } catch {
      return {};
    }
  }

  function renderDomainSummary() {
    if (!selectedDomainSummary) return;
    const domain = selectedDomainRegistration();

    if (!domain?.name) {
      selectedDomainSummary.style.display = 'none';
      selectedDomainSummary.innerHTML = '';
      return;
    }

    selectedDomainSummary.style.display = 'block';
    selectedDomainSummary.innerHTML = `
      <div class="domain-selected-box">
        <div>
          <strong>Selected new domain:</strong> ${esc(domain.name)}
          <small>${esc(priceLabel(domain))}</small>
        </div>
        <a class="btn-ghost" href="/builder/?project=${encodeURIComponent(projectId || '')}">Change domain</a>
      </div>
    `;

    const registerRadio = document.querySelector('input[name="domainOption"][value="register_new"]');
    if (registerRadio && (projectData.domain_option === 'register_new' || domain.name)) registerRadio.checked = true;
  }

  async function loadProject() {
    if (!projectId) return;

    try {
      const data = await api(`/api/projects/get?id=${encodeURIComponent(projectId)}`);
      projectData = parseProjectData(data.project || {});
      renderDomainSummary();
    } catch (error) {
      console.warn('Could not load project domain data:', error);
    }
  }

  async function createCheckout(plan) {
    if (!projectId) return showMessage('No project selected. Go back to your dashboard and choose a project to publish.', 'error');

    const domainOption = selectedDomainOption();
    const domainRegistration = selectedDomainRegistration();

    if (domainOption === 'register_new' && !domainRegistration?.name) {
      showMessage('Choose and save an available domain in the builder before selecting “Register a new domain”.', 'error');
      return;
    }

    showMessage('Preparing checkout...', 'info');

    try {
      const data = await api('/api/billing/create-checkout', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          plan,
          domain_option: domainOption,
          domain_registration: domainRegistration
        })
      });

      if (data.url) { window.location.href = data.url; return; }
      if (data.setup_required) { showMessage(data.message || 'Stripe is not connected yet.', 'info'); return; }
      showMessage('Checkout was created, but no redirect URL was returned.', 'error');
    } catch (error) {
      showMessage(error.message || 'Could not start checkout.', 'error');
    }
  }

  async function publishAfterPayment() {
    if (!projectId) return;
    showMessage('Checking payment and publishing your website...', 'info');

    try {
      const data = await api('/api/projects/publish', { method: 'POST', body: JSON.stringify({ project_id: projectId, domain_option: selectedDomainOption() }) });
      if (data.published) { showMessage(`Your website is live: ${data.live_url}`, 'success'); return; }
      if (data.payment_required) { showMessage('Payment is not active yet. If you have just paid, wait a few seconds and refresh this page.', 'info'); return; }
      showMessage(data.message || 'Publish status is unclear.', 'info');
    } catch (error) { showMessage(error.message || 'Could not publish website.', 'error'); }
  }

  document.querySelectorAll('.planBtn').forEach((button) => button.addEventListener('click', () => createCheckout(button.dataset.plan)));
  document.querySelectorAll('input[name="domainOption"]').forEach((input) => input.addEventListener('change', renderDomainSummary));

  loadProject().then(() => {
    if (success) publishAfterPayment();
    if (cancelled) showMessage('Checkout was cancelled. Your website is still saved as a draft.', 'info');
  });
});
