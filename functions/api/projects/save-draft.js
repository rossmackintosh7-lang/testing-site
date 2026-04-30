import { jsonResponse, readJson, requireMethod, cleanText, makeId, nowIso } from "../_lib/http.js";

export async function onRequestPost(context) {
  const methodError = requireMethod(context.request, "POST");
  if (methodError) return methodError;

  const { env, request } = context;
  if (!env.DB) return jsonResponse({ error: "D1 binding DB is missing." }, 500);

  const body = await readJson(request);
  const id = cleanText(body.id, 120) || makeId("project");
  const userId = cleanText(body.userId, 120);
  const projectName = cleanText(body.projectName, 180) || "Untitled website";
  const status = cleanText(body.status, 40) || "draft";
  const projectJson = JSON.stringify(body.project || {});
  const updatedAt = nowIso();

  await env.DB.prepare(`
    INSERT INTO pbi_projects (id, user_id, project_name, status, project_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_name = excluded.project_name,
      status = excluded.status,
      project_json = excluded.project_json,
      updated_at = excluded.updated_at
  `).bind(id, userId || null, projectName, status, projectJson, updatedAt, updatedAt).run();

  return jsonResponse({ success: true, projectId: id, updatedAt });
}
