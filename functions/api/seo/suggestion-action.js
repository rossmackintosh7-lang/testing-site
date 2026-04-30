import { jsonResponse, readJson, cleanText } from "../_lib/http.js";
import { ensureSeoTables } from "../_lib/seo.js";

export async function onRequestPost({ request, env }) {
  await ensureSeoTables(env);
  const body = await readJson(request);
  const id = Number(body.id);
  const action = cleanText(body.action, 30).toLowerCase();
  const allowed = { approve: "approved", save: "saved", reject: "rejected", pending: "pending" };
  if (!id || !allowed[action]) return jsonResponse({ error: "Valid id and action are required. Use approve, save, reject, or pending." }, 400);
  await env.DB.prepare(`UPDATE seo_suggestions SET status=? WHERE id=?`).bind(allowed[action], id).run();
  return jsonResponse({ success: true, id, status: allowed[action], message: "Suggestion status updated. Publishing remains manual/approval-based." });
}
