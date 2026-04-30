window.PBIAuth = (() => {
  function showMessage(id, kind, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'block';
    el.className = `notice ${kind}`;
    el.textContent = text;
  }

  async function requestJson(path, body) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  function attachSignup(formId, messageId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }
      try {
        const params = new URLSearchParams(window.location.search);
        const templatePreset = params.get('template_preset') || '';
        const data = await requestJson('/api/auth/signup', {
          email: fd.get('email'),
          password: fd.get('password'),
          project_name: fd.get('project_name'),
          template_preset: templatePreset,
          terms_accepted: fd.get('terms_accepted') === 'on',
          terms_version: fd.get('terms_version') || '2026-04-28',
          turnstileToken: fd.get('cf-turnstile-response')
        });
        showMessage(messageId, 'success', 'Account created. Redirecting...');
        const target = templatePreset && data.project?.id
          ? `/builder/?project=${encodeURIComponent(data.project.id)}&preset=${encodeURIComponent(templatePreset)}`
          : '/dashboard/';
        setTimeout(() => { location.href = target; }, 500);
      } catch (err) {
        showMessage(messageId, 'error', err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Create account'; }
      }
    });
  }

  function attachLogin(formId, messageId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      try {
        await requestJson('/api/auth/login', {
          email: fd.get('email'),
          password: fd.get('password'),
          turnstileToken: fd.get('cf-turnstile-response')
        });
        showMessage(messageId, 'success', 'Logged in. Redirecting...');
        setTimeout(() => { location.href = '/dashboard/'; }, 500);
      } catch (err) {
        showMessage(messageId, 'error', err.message);
      }
    });
  }

  return { attachSignup, attachLogin };
})();
