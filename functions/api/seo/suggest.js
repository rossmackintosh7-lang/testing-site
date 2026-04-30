import { jsonResponse, readJson, cleanText, nowIso } from "../_lib/http.js";
import { callOpenAIJson } from "../_lib/openai.js";
import { ensureSeoTables } from "../_lib/seo.js";

const suggestionSchema = () => ({
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["suggestion_type", "current_value", "suggested_value", "reasoning"],
        properties: {
          suggestion_type: { type: "string" },
          current_value: { type: "string" },
          suggested_value: { type: "string" },
          reasoning: { type: "string" }
        }
      }
    }
  }
});

export async function onRequestPost(context) {
  const { request, env } = context;
  await ensureSeoTables(env);
  const body = await readJson(request);
  const pageUrl = cleanText(body.page_url || body.url, 500);
  if (!pageUrl) return jsonResponse({ error: "page_url is required." }, 400);
  const page = await env.DB.prepare(`SELECT * FROM seo_pages WHERE url=?`).bind(pageUrl).first();
  if (!page) return jsonResponse({ error: "Page has not been scanned yet. Run an SEO scan first." }, 404);
  const issues = await env.DB.prepare(`SELECT * FROM seo_issues WHERE page_url=? AND status='open' ORDER BY created_at DESC LIMIT 20`).bind(pageUrl).all();
  const prompt = `Create approval-based SEO improvement suggestions for this PBI page.\nURL: ${page.url}\nTitle: ${page.title || ""}\nMeta description: ${page.meta_description || ""}\nH1: ${page.h1 || ""}\nWord count: ${page.word_count || 0}\nSEO score: ${page.seo_score || 0}\nOpen issues: ${JSON.stringify(issues.results || [])}\nRules: UK English. Do not keyword stuff. Do not invent claims. Suggestions must be safe drafts for human approval.`;
  const ai = await callOpenAIJson(env, { system: "You are PBI's SEO Agent. Return JSON only.", prompt, schemaName: "pbi_seo_suggestions", schema: suggestionSchema(), temperature: 0.35 });
  if (!ai.ok) return ai.response;
  const saved = [];
  for (const s of ai.data.suggestions) {
    const result = await env.DB.prepare(`INSERT INTO seo_suggestions (page_url,suggestion_type,current_value,suggested_value,reasoning,status,created_at) VALUES (?,?,?,?,?,?,?)`).bind(pageUrl, s.suggestion_type, s.current_value, s.suggested_value, s.reasoning, "pending", nowIso()).run();
    saved.push({ id: result.meta?.last_row_id, ...s, status: "pending" });
  }
  return jsonResponse({ success: true, suggestions: saved });
}
