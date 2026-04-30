import { jsonResponse, readJson, requireMethod, cleanText, makeId, nowIso } from "../_lib/http.js";
import { callOpenAIJson } from "../_lib/openai.js";
import { sectionImprovementSchema } from "../_lib/schemas.js";

export async function onRequestPost(context) {
  const methodError = requireMethod(context.request, "POST");
  if (methodError) return methodError;

  const { env, request } = context;
  const body = await readJson(request);

  const sectionKey = cleanText(body.sectionKey, 80);
  const currentContent = cleanText(body.currentContent, 5000);
  const instruction = cleanText(body.instruction, 2000);
  const businessContext = cleanText(body.businessContext, 4000);
  const projectId = cleanText(body.projectId, 120);
  const userId = cleanText(body.userId, 120);

  if (!sectionKey || !currentContent) {
    return jsonResponse({ error: "sectionKey and currentContent are required." }, 400);
  }

  const prompt = `
Improve one section of a customer's website.

Section key: ${sectionKey}
Current content:
${currentContent}

Business context:
${businessContext || "Not provided"}

Customer instruction:
${instruction || "Improve this section so it is clearer, more useful and more persuasive."}

Rules:
- Use UK English.
- Do not invent facts, awards, reviews, certifications, exact prices or years trading.
- Keep it suitable for a real small business.
`;

  const ai = await callOpenAIJson(env, {
    system: "You improve website sections for PBI. Return only JSON matching the schema.",
    prompt,
    schemaName: "pbi_section_improvement",
    schema: sectionImprovementSchema(),
    temperature: 0.5
  });

  if (!ai.ok) return ai.response;

  if (env.DB) {
    await env.DB.prepare(`INSERT INTO ai_agent_messages (id, project_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(makeId("msg"), projectId || null, userId || null, "assistant", JSON.stringify({ type: "section_improvement", input: { sectionKey, currentContent, instruction }, output: ai.data }), nowIso())
      .run();
  }

  return jsonResponse({ success: true, improvement: ai.data });
}
