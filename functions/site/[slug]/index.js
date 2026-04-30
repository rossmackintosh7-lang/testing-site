export async function onRequestGet({ params, env }) {
  const slug = String(params.slug || '').trim();

  if (!slug) {
    return new Response('Site not found.', { status: 404 });
  }

  const project = await env.DB
    .prepare(`
      SELECT *
      FROM projects
      WHERE public_slug = ?
        AND published = 1
      LIMIT 1
    `)
    .bind(slug)
    .first();

  if (!project) {
    return new Response('This website is not published yet.', { status: 404 });
  }

  let data = {};

  try {
    data =
      typeof project.data_json === 'string'
        ? JSON.parse(project.data_json || '{}')
        : {};
  } catch {
    data = {};
  }

  return new Response(renderSite(project, data), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60'
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normaliseTemplate(value) {
  const legacyMap = {
    fashion: 'retail',
    restaurant: 'hospitality',
    calm: 'studio',
    tech: 'event',
    minimal: 'studio'
  };

  const validTemplates = ['service', 'hospitality', 'retail', 'studio', 'event'];

  if (validTemplates.includes(value)) {
    return value;
  }

  return legacyMap[value] || 'service';
}

function renderSite(project, data) {
  const businessName = data.business_name || project.name || 'Website';
  const pages = data.pages || {};

  const selectedPages =
    Array.isArray(data.selected_pages) && data.selected_pages.length
      ? Array.from(new Set(['home', ...data.selected_pages]))
      : ['home', 'about', 'services', 'contact'];

  const template = normaliseTemplate(data.template || 'service');

  const accent = data.accent_color || '#256b5b';
  const background = data.background_color || '#f5f1e9';
  const text = data.text_color || '#19231f';
  const button = data.button_color || accent;
  const buttonText = data.button_text_color || '#ffffff';

  const pageNav = selectedPages
    .map((key) => {
      const page = pages[key] || {};
      const label = page.label || key.charAt(0).toUpperCase() + key.slice(1);

      return `<a href="#${escapeHtml(key)}">${escapeHtml(label)}</a>`;
    })
    .join('');

  const sections = selectedPages
    .map((key) => {
      const page = pages[key] || {};
      const title = page.title || (key === 'home' ? data.page_main_heading : key);
      const body = page.body || (key === 'home' ? data.sub_heading : '');

      if (key === 'home') {
        return '';
      }

      if (key === 'gallery') {
        const images = Array.isArray(data.gallery_images) ? data.gallery_images : [];

        return `
          <section id="${escapeHtml(key)}" class="published-section published-gallery-section">
            <h2>${escapeHtml(title || 'Gallery')}</h2>
            <p>${escapeHtml(body || '')}</p>

            <div class="published-gallery">
              ${
                images.length
                  ? images.map((image) => `<img src="${image}" alt="">`).join('')
                  : '<div class="published-empty-gallery">No gallery images have been added yet.</div>'
              }
            </div>
          </section>
        `;
      }

      return `
        <section id="${escapeHtml(key)}" class="published-section">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(body)}</p>
        </section>
      `;
    })
    .join('');

  const logo = data.logo_data_url
    ? `<img class="published-logo-img" src="${data.logo_data_url}" alt="${escapeHtml(businessName)} logo">`
    : `<span class="published-logo-dot"></span>`;

  const home = pages.home || {};

  const heroTitle = data.page_main_heading || home.title || businessName;
  const heroBody = data.sub_heading || home.body || '';
  const cta = buildCta(data);

  const galleryImages = Array.isArray(data.gallery_images) ? data.gallery_images : [];
  const firstImage = galleryImages.length ? galleryImages[0] : '';
  const bgImage = data.background_image_data_url || '';

  const templateHero = {
    service: renderServiceHero,
    hospitality: renderHospitalityHero,
    retail: renderRetailHero,
    studio: renderStudioHero,
    event: renderEventHero
  }[template] || renderServiceHero;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(businessName)}</title>

  <style>
    :root {
      --accent: ${escapeHtml(accent)};
      --background: ${escapeHtml(background)};
      --text: ${escapeHtml(text)};
      --button: ${escapeHtml(button)};
      --buttonText: ${escapeHtml(buttonText)};
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, Arial, sans-serif;
      color: var(--text);
      background: var(--background);
    }

    a {
      color: inherit;
    }

    .published-wrap {
      min-height: 100vh;
      overflow: hidden;
    }

    header {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0;
      display: flex;
      justify-content: space-between;
      gap: 22px;
      align-items: center;
    }

    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
      font-weight: 950;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .published-logo-img {
      width: 58px;
      height: 58px;
      object-fit: contain;
    }

    .published-logo-dot {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      background: var(--accent);
      display: inline-block;
    }

    nav {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    nav a {
      text-decoration: none;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,0.22);
      border: 1px solid rgba(127,127,127,0.16);
      font-weight: 850;
      font-size: 14px;
    }

    .cta {
      display: inline-flex;
      margin-top: 18px;
      padding: 14px 22px;
      border-radius: 999px;
      color: var(--buttonText);
      background: var(--button);
      text-decoration: none;
      font-weight: 950;
    }

    .hero {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 70px 0 72px;
    }

    .kicker {
      display: inline-flex;
      margin-bottom: 18px;
      color: var(--accent);
      font-weight: 950;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-size: 12px;
    }

    h1 {
      margin: 0;
      max-width: 900px;
      font-size: clamp(48px, 8vw, 96px);
      line-height: 0.9;
      letter-spacing: -0.07em;
    }

    .hero p {
      max-width: 690px;
      font-size: 20px;
      line-height: 1.5;
      color: color-mix(in srgb, var(--text) 76%, transparent);
    }

    main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      display: grid;
      gap: 22px;
      padding-bottom: 70px;
    }

    .published-section {
      padding: 40px;
      border-radius: 28px;
      background: rgba(255,255,255,0.56);
      border: 1px solid rgba(127,127,127,0.16);
      backdrop-filter: blur(10px);
    }

    .published-section h2 {
      margin: 0 0 14px;
      font-size: clamp(32px, 4vw, 58px);
      letter-spacing: -0.05em;
      line-height: 0.96;
    }

    .published-section p {
      max-width: 760px;
      font-size: 18px;
      line-height: 1.6;
    }

    .published-gallery {
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 14px;
      margin-top: 22px;
    }

    .published-gallery img {
      width: 100%;
      aspect-ratio: 1 / 0.78;
      object-fit: cover;
      border-radius: 18px;
    }

    .published-empty-gallery {
      grid-column: 1 / -1;
      padding: 24px;
      border: 1px dashed rgba(127,127,127,0.3);
      border-radius: 18px;
      color: color-mix(in srgb, var(--text) 68%, transparent);
    }

    footer {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 26px 0 44px;
      font-weight: 850;
      color: color-mix(in srgb, var(--text) 64%, transparent);
    }

    /* Local Service Pro */

    body.template-service {
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 18%, transparent), transparent 36%),
        linear-gradient(135deg, var(--background), #ffffff);
    }

    body.template-service .hero {
      display: grid;
      grid-template-columns: 1fr 310px;
      gap: 36px;
      align-items: stretch;
    }

    .service-panel {
      padding: 28px;
      border-radius: 30px;
      color: #fff;
      background: var(--accent);
      box-shadow: 0 28px 80px rgba(0,0,0,0.12);
    }

    .service-panel h2 {
      margin: 0;
      font-size: 30px;
      letter-spacing: -0.04em;
    }

    .service-panel ul {
      padding: 0;
      margin: 16px 0 0;
      list-style: none;
      display: grid;
      gap: 12px;
      font-weight: 850;
    }

    .service-panel li {
      position: relative;
      padding-left: 24px;
    }

    .service-panel li::before {
      content: "✓";
      position: absolute;
      left: 0;
    }

    /* Food & Hospitality */

    body.template-hospitality {
      background:
        linear-gradient(135deg, #2d160d, color-mix(in srgb, var(--accent) 52%, #2d160d));
      color: #fff8f1;
    }

    body.template-hospitality header,
    body.template-event header {
      color: #fff;
    }

    .hospitality-hero {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto 46px;
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 0;
      align-items: center;
    }

    .hospitality-image {
      min-height: 540px;
      border-radius: 0 52px 52px 0;
      background: color-mix(in srgb, var(--accent) 36%, #fff8f1);
      background-size: cover;
      background-position: center;
    }

    .hospitality-card {
      padding: 44px;
      border-radius: 34px;
      background: rgba(255,248,241,0.96);
      color: #2d160d;
      transform: translateX(-34px);
      box-shadow: 0 28px 90px rgba(0,0,0,0.22);
    }

    .hospitality-card h1 {
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 500;
    }

    /* Boutique Retail */

    body.template-retail {
      background: linear-gradient(135deg, var(--background), #ffe367);
      color: #111;
    }

    .retail-topline {
      padding: 10px;
      text-align: center;
      color: #fff;
      background: #111;
      font-size: 12px;
      font-weight: 950;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .retail-products {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 34px;
    }

    .retail-product {
      min-height: 180px;
      border-radius: 24px;
      background: rgba(255,255,255,0.44);
      overflow: hidden;
      display: grid;
      place-items: center;
      font-weight: 950;
    }

    .retail-product img {
      width: 100%;
      height: 100%;
      min-height: 180px;
      object-fit: cover;
    }

    /* Premium Studio */

    body.template-studio {
      background: linear-gradient(135deg, #fffaf5, var(--background));
    }

    body.template-studio h1 {
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 400;
      letter-spacing: -0.04em;
    }

    .studio-hero {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 68px 0;
      display: grid;
      grid-template-columns: 0.86fr 1.14fr;
      gap: 48px;
      align-items: center;
    }

    .studio-image {
      min-height: 460px;
      border-radius: 150px 0 150px 0;
      background: color-mix(in srgb, var(--accent) 18%, #fff);
      overflow: hidden;
      display: grid;
      place-items: center;
      font-weight: 900;
    }

    .studio-image img {
      width: 100%;
      height: 100%;
      min-height: 460px;
      object-fit: cover;
    }

    /* Event Launch */

    body.template-event {
      background:
        radial-gradient(circle at 72% 28%, color-mix(in srgb, var(--accent) 42%, transparent), transparent 28%),
        linear-gradient(135deg, #070717, #101033 64%, #080817);
      color: #f5f0ff;
    }

    .event-hero {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 74px 0;
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 46px;
      align-items: center;
    }

    .event-orb {
      aspect-ratio: 1;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 34% 28%, #fff, transparent 9%),
        radial-gradient(circle at 50% 50%, var(--accent), transparent 43%),
        conic-gradient(from 90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6);
      box-shadow: 0 0 90px color-mix(in srgb, var(--accent) 55%, transparent);
      font-weight: 950;
      letter-spacing: 0.18em;
    }

    body.template-event .published-section,
    body.template-hospitality .published-section {
      background: rgba(255,255,255,0.10);
      border-color: rgba(255,255,255,0.14);
    }

    @media (max-width: 840px) {
      header,
      body.template-service .hero,
      .hospitality-hero,
      .studio-hero,
      .event-hero {
        grid-template-columns: 1fr;
        flex-direction: column;
        align-items: flex-start;
      }

      .hospitality-card {
        transform: none;
      }

      .retail-products,
      .published-gallery {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body class="template-${escapeHtml(template)}">
  <div class="published-wrap">
    ${template === 'retail' ? '<div class="retail-topline">New arrivals • Local favourites • Shop small</div>' : ''}

    <header>
      <div class="brand">
        ${logo}
        <span>${escapeHtml(businessName)}</span>
      </div>

      <nav>${pageNav}</nav>
    </header>

    ${templateHero({
      businessName,
      heroTitle,
      heroBody,
      accent,
      firstImage,
      bgImage,
      logo
    })}

    <main>
      ${sections}
    </main>

    <footer>
      © ${escapeHtml(businessName)} • Built with PBI
    </footer>
  </div>
</body>
</html>`;
}


function buildCta(data) {
  const label = escapeHtml(data.cta_button_text || 'Get in touch');
  const action = data.cta_button_action || 'contact';
  const destination = String(data.cta_button_destination || '').trim();
  const page = data.cta_button_page || 'contact';
  let href = '#contact';

  if (action === 'none') href = '#';
  if (action === 'page') href = '#' + encodeURIComponent(page);
  if (action === 'external') href = destination || '#';
  if (action === 'email') href = destination ? 'mailto:' + destination.replace(/^mailto:/, '') : '#contact';
  if (action === 'phone') href = destination ? 'tel:' + destination.replace(/^tel:/, '') : '#contact';

  return `<a class="cta" href="${escapeHtml(href)}">${label}</a>`;
}

function renderServiceHero({ heroTitle, heroBody, cta }) {
  return `
    <section class="hero">
      <div>
        <span class="kicker">Local service pro</span>
        <h1>${escapeHtml(heroTitle)}</h1>
        <p>${escapeHtml(heroBody)}</p>
        ${cta}
      </div>

      <aside class="service-panel">
        <h2>How we help</h2>
        <ul>
          <li>Clear information for customers</li>
          <li>Services explained properly</li>
          <li>Simple route to enquiries</li>
        </ul>
      </aside>
    </section>
  `;
}

function renderHospitalityHero({ heroTitle, heroBody, cta, firstImage, bgImage }) {
  const image = firstImage || bgImage;

  return `
    <section class="hospitality-hero">
      <div
        class="hospitality-image"
        ${image ? `style="background-image:url('${image}')"` : ''}
      ></div>

      <div class="hospitality-card">
        <span class="kicker">Food & hospitality</span>
        <h1>${escapeHtml(heroTitle)}</h1>
        <p>${escapeHtml(heroBody)}</p>
        ${cta}
      </div>
    </section>
  `;
}

function renderRetailHero({ heroTitle, heroBody, cta }) {
  return `
    <section class="hero">
      <div>
        <span class="kicker">Boutique retail</span>
        <h1>${escapeHtml(heroTitle)}</h1>
        <p>${escapeHtml(heroBody)}</p>
        ${cta}
      </div>

      <div class="retail-products">
        <div class="retail-product">Featured</div>
        <div class="retail-product">New</div>
        <div class="retail-product">Local</div>
        <div class="retail-product">Offers</div>
      </div>
    </section>
  `;
}

function renderStudioHero({ heroTitle, heroBody, cta, firstImage, bgImage }) {
  const image = firstImage || bgImage;

  return `
    <section class="studio-hero">
      <div>
        <span class="kicker">Premium studio</span>
        <h1>${escapeHtml(heroTitle)}</h1>
        <p>${escapeHtml(heroBody)}</p>
        ${cta}
      </div>

      <div class="studio-image">
        ${image ? `<img src="${image}" alt="">` : 'Upload a calm premium image'}
      </div>
    </section>
  `;
}

function renderEventHero({ heroTitle, heroBody, cta }) {
  return `
    <section class="event-hero">
      <div>
        <span class="kicker">Event launch</span>
        <h1>${escapeHtml(heroTitle)}</h1>
        <p>${escapeHtml(heroBody)}</p>
        ${cta}
      </div>

      <div class="event-orb">LIVE</div>
    </section>
  `;
}

export async function onRequestPost() {
  return new Response('Method not allowed.', { status: 405 });
}
