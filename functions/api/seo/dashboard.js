import { jsonResponse } from "../_lib/http.js";
import { ensureSeoTables } from "../_lib/seo.js";

export async function onRequestGet({ env }) {
  await ensureSeoTables(env);
  const pages = await env.DB.prepare(`SELECT * FROM seo_pages ORDER BY seo_score ASC, last_checked DESC LIMIT 50`).all();
  const issues = await env.DB.prepare(`SELECT * FROM seo_issues WHERE status='open' ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC LIMIT 100`).all();
  const suggestions = await env.DB.prepare(`SELECT * FROM seo_suggestions ORDER BY created_at DESC LIMIT 50`).all();
  const keywords = await env.DB.prepare(`SELECT * FROM seo_keywords ORDER BY created_at DESC LIMIT 100`).all();
  const latestReport = await env.DB.prepare(`SELECT * FROM seo_reports ORDER BY created_at DESC LIMIT 1`).first();
  const pageRows = pages.results || [];
  const issueRows = issues.results || [];
  const avg = pageRows.length ? Math.round(pageRows.reduce((sum, p) => sum + Number(p.seo_score || 0), 0) / pageRows.length) : 0;
  return jsonResponse({
    success: true,
    summary: {
      seoScore: latestReport?.average_score || avg,
      pagesScanned: latestReport?.total_pages || pageRows.length,
      openIssues: issueRows.length,
      highIssues: issueRows.filter(i => i.severity === "high").length,
      mediumIssues: issueRows.filter(i => i.severity === "medium").length,
      latestReport
    },
    pages: pageRows,
    issues: issueRows,
    suggestions: suggestions.results || [],
    keywords: keywords.results || []
  });
}
