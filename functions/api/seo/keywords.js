import { jsonResponse, readJson, cleanText, nowIso } from "../_lib/http.js";
import { ensureSeoTables } from "../_lib/seo.js";

const starterKeywords = [
  ["AI website builder", "/", "commercial", "high"],
  ["AI website builder for small businesses", "/", "commercial", "high"],
  ["small business website builder", "/builder/", "commercial", "high"],
  ["affordable websites for small businesses", "/pricing/", "commercial", "high"],
  ["custom website design Dorset", "/custom-build/", "local", "high"],
  ["website design Swanage", "/", "local", "medium"],
  ["website design Wareham", "/", "local", "medium"],
  ["website design Purbeck", "/", "local", "high"],
  ["websites for trades", "/websites-for-tradespeople/", "commercial", "medium"],
  ["websites for cafes", "/websites-for-cafes/", "commercial", "medium"],
  ["websites for salons", "/websites-for-salons/", "commercial", "medium"],
  ["websites for shops", "/websites-for-shops/", "commercial", "medium"],
  ["websites for consultants", "/websites-for-consultants/", "commercial", "medium"],
  ["websites for holiday lets", "/websites-for-holiday-lets/", "commercial", "medium"],
  ["website help for local businesses", "/custom-build/", "support", "medium"],
  ["assisted website setup", "/pricing/", "commercial", "medium"]
];

export async function onRequestGet({ env }) {
  await ensureSeoTables(env);
  const count = await env.DB.prepare(`SELECT COUNT(*) as total FROM seo_keywords`).first();
  if (!count?.total) {
    for (const row of starterKeywords) await env.DB.prepare(`INSERT INTO seo_keywords (keyword,target_url,intent,priority,status,created_at) VALUES (?,?,?,?,?,?)`).bind(row[0], row[1], row[2], row[3], "active", nowIso()).run();
  }
  const keywords = await env.DB.prepare(`SELECT * FROM seo_keywords ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, keyword ASC`).all();
  return jsonResponse({ success: true, keywords: keywords.results || [] });
}

export async function onRequestPost({ request, env }) {
  await ensureSeoTables(env);
  const body = await readJson(request);
  const keyword = cleanText(body.keyword, 180);
  if (!keyword) return jsonResponse({ error: "keyword is required." }, 400);
  const targetUrl = cleanText(body.target_url || body.targetUrl, 300) || null;
  const intent = cleanText(body.intent, 80) || null;
  const priority = cleanText(body.priority, 20) || "medium";
  const result = await env.DB.prepare(`INSERT INTO seo_keywords (keyword,target_url,intent,priority,status,created_at) VALUES (?,?,?,?,?,?)`).bind(keyword, targetUrl, intent, priority, "active", nowIso()).run();
  return jsonResponse({ success: true, id: result.meta?.last_row_id });
}
