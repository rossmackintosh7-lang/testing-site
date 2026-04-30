document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('customBuildForm');
  const message = document.getElementById('customBuildMessage');
  const submit = document.getElementById('customBuildSubmitBtn');

  function show(text, type = 'info') {
    if (!message) return;
    message.textContent = text;
    message.className = `notice domain-${type}`;
    message.style.display = 'block';
  }

  async function api(path, body) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed with ${response.status}`);
    return data;
  }

  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    if (submit) { submit.disabled = true; submit.textContent = 'Submitting...'; }
    show('Submitting your custom build request...', 'info');
    try {
      await api('/api/custom-build/enquiry', payload);
      form.reset();
      show('Your custom build request has been sent successfully. PBI will review the project scope and come back to you.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      show(error.message || 'Could not submit your custom build request.', 'error');
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = 'Submit Custom Build Request'; }
    }
  });
});
