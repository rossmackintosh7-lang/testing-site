
(() => {
  async function getCurrentUser() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      return data.user || null;
    } catch {
      return null;
    }
  }

  async function createProjectFromTemplate(templateKey) {
    const presetApi = window.PBITemplatePresets;
    const preset = presetApi?.get?.(templateKey);
    if (!preset) {
      window.location.href = '/signup/';
      return;
    }

    const user = await getCurrentUser();
    if (!user) {
      window.location.href = `/signup/?template_preset=${encodeURIComponent(templateKey)}`;
      return;
    }

    const response = await fetch('/api/projects/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: preset.projectName || `${preset.businessName || 'New'} website`, template_preset: templateKey })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.project?.id) {
      throw new Error(data.error || data.message || 'Could not create project from template.');
    }

    window.location.href = `/builder/?project=${encodeURIComponent(data.project.id)}&preset=${encodeURIComponent(templateKey)}`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-use-template]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        const templateKey = button.getAttribute('data-use-template');
        const oldText = button.textContent;
        button.textContent = 'Opening...';
        button.setAttribute('disabled', 'disabled');
        try {
          await createProjectFromTemplate(templateKey);
        } catch (error) {
          alert(error.message || 'Could not open template.');
          button.textContent = oldText;
          button.removeAttribute('disabled');
        }
      });
    });
  });
})();
