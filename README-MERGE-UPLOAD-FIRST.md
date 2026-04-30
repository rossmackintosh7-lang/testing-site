# PBI exact-theme merge: original site + new AI/SEO additions

This package uses `pbi-template-demo-builder-upgrade.zip` as the base, so the original PBI homepage, logo, background image and `assets/styles.css` remain the master look and feel.

## Preserved

- `/index.html`
- `/assets/PBI Logo.png`
- `/assets/Website background image.png`
- `/assets/styles.css`
- Existing pages, builder, dashboard, examples, pricing, custom build, admin panel and existing functions

## Added

- `/seo-agent/` using the original PBI visual style
- SEO Agent API endpoints and Open Issues `Fix` button
- AI Website Agent endpoints and demo
- combined D1 schema
- `robots.txt`, `sitemap.xml`, `manifest.json`

## Cloudflare Pages

Build output directory: `.`

Run once after upload:

```bash
npx wrangler d1 execute pbi-db --file=./database/pbi-combined-schema.sql --remote
```

Test:
`/`, `/examples/`, `/builder/`, `/dashboard/`, `/admin/`, `/seo-agent/`, `/demo/agent-dashboard.html`, `/api/seo/dashboard`, `/scheduled?token=YOUR_ADMIN_TOKEN`
