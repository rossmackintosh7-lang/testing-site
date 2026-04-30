import { jsonResponse, readJson, cleanText, nowIso } from "../_lib/http.js";
import { callOpenAIJson } from "../_lib/openai.js";
import { ensureSeoTables } from "../_lib/seo.js";

const fixSchema = () => ({
  type: "object",
  additionalProperties: false,
  required: ["suggestion_type", "current_value", "suggested_value", "reasoning"],
  properties: {
    suggestion_type: { type: "string" },
    current_value: { type: "string" },
    suggested_value: { type: "string" },
    reasoning: { type: "string" }
  }
});

function pageLabel(pageUrl = "") {
  let path = pageUrl;
  try { path = new URL(pageUrl).pathname; } catch {}
  if (path.includes("trades")) return "websites for tradespeople";
  if (path.includes("cafes")) return "websites for cafés";
  if (path.includes("salons")) return "websites for salons";
  if (path.includes("shops")) return "websites for shops";
  if (path.includes("consultants")) return "websites for consultants";
  if (path.includes("holiday")) return "websites for holiday lets";
  if (path.includes("pricing")) return "website pricing";
  if (path.includes("builder")) return "AI website builder";
  if (path.includes("custom-build")) return "custom website build support";
  return "small business websites";
}

function sentenceCase(value) {
  value = String(value || "");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function builtInFix(issue, page) {
  const type = String(issue.issue_type || "");
  const label = pageLabel(page.url);
  if (type.includes("title")) {
    return {
      suggestion_type: "title",
      current_value: page.title || "",
      suggested_value: `${sentenceCase(label)} in Dorset | PBI`,
      reasoning: "Drafted a clearer search title with the page theme, location signal and brand. Keep it natural and avoid keyword stuffing."
    };
  }
  if (type.includes("meta")) {
    return {
      suggestion_type: "meta_description",
      current_value: page.meta_description || "",
      suggested_value: `Build a clearer, more useful ${label} page with Purbeck Business Innovations. AI-assisted setup, practical support and approval-based SEO improvements for small businesses.`,
      reasoning: "Created a human-readable description that explains the service and includes relevant local/business context."
    };
  }
  if (type.includes("h1")) {
    return {
      suggestion_type: "h1",
      current_value: page.h1 || "",
      suggested_value: `${sentenceCase(label)} that are ready to work`,
      reasoning: "Suggested a visible page heading that is specific, readable and aligned with the page purpose."
    };
  }
  if (type.includes("canonical")) {
    return {
      suggestion_type: "canonical",
      current_value: page.canonical || "",
      suggested_value: `<link rel="canonical" href="${page.url}">`,
      reasoning: "Canonical tags help search engines understand the preferred version of a page."
    };
  }
  if (type.includes("structured")) {
    return {
      suggestion_type: "schema",
      current_value: "Missing or weak JSON-LD structured data",
      suggested_value: `Add Organization, WebSite, Service, BreadcrumbList and FAQPage JSON-LD relevant to ${label}.`,
      reasoning: "Structured data gives search engines clearer context about the business, service and page hierarchy."
    };
  }
  if (type.includes("image_alt")) {
    return {
      suggestion_type: "image_alt_text",
      current_value: issue.issue_text || "Images missing useful alt text",
      suggested_value: `Add descriptive alt text that explains each image in context, for example: "Example ${label} homepage layout for a Dorset small business".`,
      reasoning: "Useful alt text supports accessibility and gives search engines better image context."
    };
  }
  if (type.includes("internal")) {
    return {
      suggestion_type: "internal_links",
      current_value: "Low internal linking",
      suggested_value: "Add natural links to /builder/, /pricing/, /custom-build/, /examples/ and the most relevant industry pages.",
      reasoning: "Internal links help visitors and search engines discover related PBI pages."
    };
  }
  if (type.includes("thin")) {
    return {
      suggestion_type: "content_expansion",
      current_value: `${page.word_count || 0} words detected`,
      suggested_value: `Add a practical section explaining who the ${label} page is for, what PBI builds, what is included, example use cases, FAQs and a clear call to action.`,
      reasoning: "Helpful, specific content is more likely to satisfy search intent than a thin page."
    };
  }
  return {
    suggestion_type: type || "seo_fix",
    current_value: issue.issue_text || page.title || "",
    suggested_value: "Review this issue and draft a human-approved improvement for the affected page section.",
    reasoning: "Fallback fix created because this issue type needs manual review."
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  await ensureSeoTables(env);
  const body = await readJson(request);
  const issueId = Number(body.issue_id || body.id || 0);
  if (!issueId) return jsonResponse({ error: "issue_id is required." }, 400);

  const issue = await env.DB.prepare(`SELECT * FROM seo_issues WHERE id=? AND status='open'`).bind(issueId).first();
  if (!issue) return jsonResponse({ error: "Open issue was not found. Run a scan or refresh the dashboard." }, 404);

  const page = await env.DB.prepare(`SELECT * FROM seo_pages WHERE url=?`).bind(issue.page_url).first();
  if (!page) return jsonResponse({ error: "Page has not been scanned yet. Run an SEO scan first." }, 404);

  let draft = builtInFix(issue, page);

  if (env.OPENAI_API_KEY) {
    const prompt = `Create one approval-based fix suggestion for this specific PBI SEO issue.\nPage URL: ${page.url}\nPage title: ${page.title || ""}\nMeta description: ${page.meta_description || ""}\nH1: ${page.h1 || ""}\nWord count: ${page.word_count || 0}\nIssue type: ${issue.issue_type}\nIssue severity: ${issue.severity}\nIssue text: ${issue.issue_text}\nRules: UK English. Do not keyword stuff. Do not invent claims. Do not auto-publish. Return one practical fix the user can approve.`;
    const ai = await callOpenAIJson(env, { system: "You are PBI's SEO Agent. Return JSON only.", prompt, schemaName: "pbi_seo_issue_fix", schema: fixSchema(), temperature: 0.25 });
    if (ai.ok && ai.data) draft = ai.data;
  }

  const result = await env.DB.prepare(`INSERT INTO seo_suggestions (page_url,suggestion_type,current_value,suggested_value,reasoning,status,created_at) VALUES (?,?,?,?,?,?,?)`).bind(
    issue.page_url,
    cleanText(draft.suggestion_type, 100) || issue.issue_type,
    cleanText(draft.current_value, 2000),
    cleanText(draft.suggested_value, 6000),
    cleanText(`Fix for issue #${issue.id}: ${issue.issue_text}\n\n${draft.reasoning || ""}`, 6000),
    "pending",
    nowIso()
  ).run();

  return jsonResponse({ success: true, issue_id: issue.id, suggestion: { id: result.meta?.last_row_id, page_url: issue.page_url, ...draft, status: "pending" } });
}
