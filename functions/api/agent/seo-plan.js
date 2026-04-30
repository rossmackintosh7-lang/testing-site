import { jsonResponse, readJson, requireMethod, cleanText, makeId, nowIso } from "../_lib/http.js";
import { callOpenAIJson } from "../_lib/openai.js";
import { seoPlanSchema } from "../_lib/schemas.js";

export async function onRequestPost(context) {
  const methodError = requireMethod(context.request, "POST");
  if (methodError) return methodError;

  const { env, request } = context;
  const body = await readJson(request);

  const businessName = cleanText(body.businessName, 120);
  const businessDescription = cleanText(body.businessDescription, 4000);
  const location = cleanText(body.location, 120);
  const services = Array.isArray(body.services) ? body.services.map(s => cleanText(String(s), 500)).join("\n") : cleanText(body.services, 3000);
  const projectId = cleanText(body.projectId, 120);
  const userId = cleanText(body.userId, 120);

  if (!businessName || !businessDescription) {
    return jsonResponse({ error: "Business name and business description are required." }, 400);
  }

  const prompt = `
Create a practical SEO starter plan for a small UK business website.

Business name: ${businessName}
Business description: ${businessDescription}
Location: ${location || "Not provided"}
Services:
${services || "Not provided"}

Rules:
- Use UK English.
- Do not promise rankings.
- Focus on practical on-page SEO and local SEO.
- Avoid keyword stuffing.
- Keep it realistic for a new or small website.
`;

  const ai = await callOpenAIJson(env, {
    system: "You create practical SEO plans for PBI website customers. Return only JSON.",
    prompt,
    schemaName: "pbi_seo_plan",
    schema: seoPlanSchema(),
    temperature: 0.35
  });

  if (!ai.ok) return ai.response;

  if (env.DB) {
    await env.DB.prepare(`INSERT INTO ai_agent_messages (id, project_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(makeId("msg"), projectId || null, userId || null, "assistant", JSON.stringify({ type: "seo_plan", output: ai.data }), nowIso())
      .run();
  }

  return jsonResponse({ success: true, seoPlan: ai.data });
}
