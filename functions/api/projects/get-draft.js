import { jsonResponse, requireMethod, cleanText, safeJsonParse } from "../_lib/http.js";

export async function onRequestGet(context) {
  const methodError = requireMethod(context.request, "GET");
  if (methodError) return methodError;

  const { env, request } = context;
  if (!env.DB) return jsonResponse({ error: "D1 binding DB is missing." }, 500);

  const url = new URL(request.url);
  const id = cleanText(url.searchParams.get("id"), 120);

  if (!id) return jsonResponse({ error: "Project id is required." }, 400);

  const row = await env.DB.prepare(`
    SELECT id, user_id, project_name, status, project_json, created_at, updated_at
    FROM pbi_projects
    WHERE id = ?
  `).bind(id).first();

  if (!row) return jsonResponse({ error: "Project not found." }, 404);

  return jsonResponse({ success: true, project: { ...row, project_json: safeJsonParse(row.project_json, {}) } });
}
