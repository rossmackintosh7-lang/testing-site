
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const templateKey = params.get('template_preset');
    if (!templateKey || !window.PBITemplatePresets) return;
    const notice = document.getElementById('templateNotice');
    const preset = window.PBITemplatePresets.get(templateKey);
    if (!notice || !preset) return;
    notice.style.display = 'block';
    notice.className = 'notice domain-success';
    notice.innerHTML = `<strong>Selected starting template:</strong> ${preset.businessName} (${preset.label}). Your first project will open in the builder with this demo preloaded.`;
  });
})();
