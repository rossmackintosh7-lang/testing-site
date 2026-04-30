(() => {
  async function postJson(path, body) {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed.');
    return data;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-lead-form]').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = form.querySelector('[data-lead-message]');
        const fd = new FormData(form);
        const button = form.querySelector('button[type="submit"]');
        const original = button?.textContent || 'Send';

        if (button) { button.disabled = true; button.textContent = 'Sending...'; }

        try {
          await postJson('/api/leads/launch-checklist', { name: fd.get('name'), email: fd.get('email') });
          if (message) { message.className = 'notice domain-success'; message.textContent = 'Checklist sent. Please check your inbox.'; message.style.display = 'block'; }
          form.reset();
        } catch (error) {
          if (message) { message.className = 'notice domain-error'; message.textContent = error.message; message.style.display = 'block'; }
        } finally {
          if (button) { button.disabled = false; button.textContent = original; }
        }
      });
    });
  });
})();