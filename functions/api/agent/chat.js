import { jsonResponse, readJson, requireMethod, cleanText, makeId, nowIso } from "../_lib/http.js";
import { callOpenAIJson } from "../_lib/openai.js";

const chatSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    suggestedActions: { type: "array", items: { type: "string" } },
    needsHumanHelp: { type: "boolean" },
    recommendedPbiService: { type: "string" }
  },
  required: ["answer", "suggestedActions", "needsHumanHelp", "recommendedPbiService"]
};

export async function onRequestPost(context) {
  const methodError = requireMethod(context.request, "POST");
  if (methodError) return methodError;

  const { env, request } = context;
  const body = await readJson(request);

  const message = cleanText(body.message, 3000);
  const projectSummary = cleanText(body.projectSummary, 5000);
  const projectId = cleanText(body.projectId, 120);
  const userId = cleanText(body.userId, 120);

  if (!message) return jsonResponse({ error: "Message is required." }, 400);

  const prompt = `
A PBI customer is building a website and has asked for help.

Customer message:
${message}

Project summary:
${projectSummary || "Not provided"}

Rules:
- Use UK English.
- Be practical and specific.
- If human help is needed, set needsHumanHelp true and recommend custom build or assisted setup.
`;

  const ai = await callOpenAIJson(env, {
    system: "You are the PBI Website Assistant inside a dashboard. Return only JSON.",
    prompt,
    schemaName: "pbi_agent_chat",
    schema: chatSchema,
    temperature: 0.45
  });

  if (!ai.ok) return ai.response;

  if (env.DB) {
    const createdAt = nowIso();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO ai_agent_messages (id, project_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(makeId("msg"), projectId || null, userId || null, "user", message, createdAt),
      env.DB.prepare(`INSERT INTO ai_agent_messages (id, project_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(makeId("msg"), projectId || null, userId || null, "assistant", JSON.stringify(ai.data), createdAt)
    ]);
  }

  return jsonResponse({ success: true, reply: ai.data });
}
