import { nowIso } from "./http.js";

export const DEFAULT_SEO_PAGES = ["/", "/builder/", "/custom-build/", "/pricing/", "/contact/", "/about/", "/examples/", "/websites-for-cafes/", "/websites-for-consultants/", "/websites-for-holiday-lets/", "/websites-for-salons/", "/websites-for-shops/", "/websites-for-tradespeople/"];

export function getBaseUrl(env, request) {
  if (env.PBI_BASE_URL) return String(env.PBI_BASE_URL).replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function getPageList(env) {
  const pages = String(env.PBI_SEO_PAGES || "").split(",").map(p => p.trim()).filter(Boolean);
  return pages.length ? pages : DEFAULT_SEO_PAGES;
}

export function stripTags(value = "") {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function decodeHtml(value = "") {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'");
}

export function extractTag(html, pattern) {
  const match = html.match(pattern);
  return match ? decodeHtml(stripTags(match[1] || match[2] || "").trim()) : "";
}

export function analyseSeo(pageUrl, html, statusCode) {
  const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const meta_description = extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) || extractTag(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const h1 = extractTag(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const canonical = extractTag(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i) || extractTag(html, /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["'][^>]*>/i);
  const robots = extractTag(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["'][^>]*>/i);
  const hasStructuredData = /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(html);
  const imageTags = html.match(/<img\b[^>]*>/gi) || [];
  const imagesMissingAlt = imageTags.filter(tag => !/\salt=["'][^"']{4,}["']/i.test(tag)).length;
  const internalLinks = (html.match(/<a\b[^>]+href=["']\//gi) || []).length;
  const words = stripTags(html);
  const word_count = words ? words.split(/\s+/).filter(Boolean).length : 0;
  const issues = [];
  let seo_score = 100;
  function add(type, text, severity = "medium", penalty = 8) { issues.push({ issue_type: type, issue_text: text, severity }); seo_score -= penalty; }
  if (statusCode < 200 || statusCode > 299) add("status", `Page returned HTTP ${statusCode}.`, "high", 18);
  if (!title) add("missing_title", "Missing page title.", "high", 14);
  else if (title.length < 30) add("short_title", "Page title is short. Aim for 30 to 60 characters.", "medium", 7);
  else if (title.length > 65) add("long_title", "Page title is long. Aim for roughly 30 to 60 characters.", "medium", 6);
  if (!meta_description) add("missing_meta_description", "Missing meta description.", "high", 14);
  else if (meta_description.length < 70) add("short_meta_description", "Meta description is short. Aim for 120 to 160 characters.", "medium", 7);
  else if (meta_description.length > 170) add("long_meta_description", "Meta description is long. Aim for 120 to 160 characters.", "medium", 6);
  if (!h1) add("missing_h1", "Missing visible H1 heading.", "high", 12);
  if (!canonical) add("missing_canonical", "Missing canonical link tag.", "medium", 5);
  if (!hasStructuredData) add("missing_structured_data", "Missing JSON-LD structured data. Add Organization, Service, Breadcrumb or FAQ schema where relevant.", "medium", 5);
  if (imagesMissingAlt > 0) add("missing_image_alt", `${imagesMissingAlt} image(s) are missing useful alt text.`, "medium", 4);
  if (internalLinks < 3) add("low_internal_links", "Page has few internal links. Add useful links to related PBI services and examples.", "medium", 4);
  if (word_count < 250) add("thin_content", "Page has thin text content. Add helpful, specific copy for this service or location.", "medium", 8);
  if (/noindex/i.test(robots)) add("noindex", "Robots meta includes noindex. This page may not appear in Google.", "high", 22);
  return { url: pageUrl, title, meta_description, h1, canonical, robots, word_count, status_code: statusCode, seo_score: Math.max(0, Math.min(100, seo_score)), issues };
}

export async function ensureSeoTables(env) {
  if (!env.DB) throw new Error("D1 DB binding is missing. Add binding DB in wrangler.toml and Cloudflare Pages.");
  const statements = [
    `CREATE TABLE IF NOT EXISTS seo_pages (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, title TEXT, meta_description TEXT, h1 TEXT, canonical TEXT, robots TEXT, word_count INTEGER DEFAULT 0, status_code INTEGER, seo_score INTEGER DEFAULT 0, last_checked TEXT)`,
    `CREATE TABLE IF NOT EXISTS seo_issues (id INTEGER PRIMARY KEY AUTOINCREMENT, page_url TEXT NOT NULL, issue_type TEXT NOT NULL, issue_text TEXT NOT NULL, severity TEXT DEFAULT 'medium', status TEXT DEFAULT 'open', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS seo_suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT, page_url TEXT NOT NULL, suggestion_type TEXT NOT NULL, current_value TEXT, suggested_value TEXT, reasoning TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS seo_keywords (id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT NOT NULL, target_url TEXT, intent TEXT, priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS seo_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, report_date TEXT NOT NULL, total_pages INTEGER DEFAULT 0, total_issues INTEGER DEFAULT 0, average_score INTEGER DEFAULT 0, summary TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();
}

export async function scanSeo(env, request) {
  await ensureSeoTables(env);
  const base = getBaseUrl(env, request);
  const pages = getPageList(env);
  const scanned = [];
  const allIssues = [];
  for (const path of pages) {
    const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
    let html = "";
    let status = 0;
    try { const res = await fetch(url, { headers: { "User-Agent": "PBI-SEO-Agent/1.0" } }); status = res.status; html = await res.text(); } catch { status = 0; }
    const result = analyseSeo(url, html, status);
    const checked = nowIso();
    await env.DB.prepare(`INSERT INTO seo_pages (url,title,meta_description,h1,canonical,robots,word_count,status_code,seo_score,last_checked) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET title=excluded.title, meta_description=excluded.meta_description, h1=excluded.h1, canonical=excluded.canonical, robots=excluded.robots, word_count=excluded.word_count, status_code=excluded.status_code, seo_score=excluded.seo_score, last_checked=excluded.last_checked`).bind(result.url, result.title, result.meta_description, result.h1, result.canonical, result.robots, result.word_count, result.status_code, result.seo_score, checked).run();
    await env.DB.prepare(`UPDATE seo_issues SET status='resolved' WHERE page_url=? AND status='open'`).bind(result.url).run();
    for (const issue of result.issues) {
      allIssues.push({ page_url: result.url, ...issue });
      await env.DB.prepare(`INSERT INTO seo_issues (page_url,issue_type,issue_text,severity,status,created_at) VALUES (?,?,?,?,?,?)`).bind(result.url, issue.issue_type, issue.issue_text, issue.severity, "open", checked).run();
    }
    scanned.push(result);
  }
  const averageScore = scanned.length ? Math.round(scanned.reduce((sum, page) => sum + page.seo_score, 0) / scanned.length) : 0;
  const report = { totalPages: scanned.length, totalIssues: allIssues.length, averageScore, highIssues: allIssues.filter(i => i.severity === "high").length, mediumIssues: allIssues.filter(i => i.severity === "medium").length };
  await env.DB.prepare(`INSERT INTO seo_reports (report_date,total_pages,total_issues,average_score,summary,created_at) VALUES (?,?,?,?,?,?)`).bind(nowIso().slice(0, 10), report.totalPages, report.totalIssues, report.averageScore, JSON.stringify(report), nowIso()).run();
  return { report, pages: scanned, issues: allIssues };
}

export function isManualRequestAllowed(request, env) {
  if (!env.PBI_ADMIN_TOKEN) return true;
  const expected = `Bearer ${env.PBI_ADMIN_TOKEN}`;
  return request.headers.get("Authorization") === expected || new URL(request.url).searchParams.get("token") === env.PBI_ADMIN_TOKEN;
}
