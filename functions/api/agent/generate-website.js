import { jsonResponse, readJson, requireMethod, cleanText, makeId, nowIso } from "../_lib/http.js";
import { callOpenAIJson } from "../_lib/openai.js";
import { websiteDraftSchema } from "../_lib/schemas.js";

export async function onRequestPost(context) {
  const methodError = requireMethod(context.request, "POST");
  if (methodError) return methodError;

  const { env, request } = context;
  const body = await readJson(request);

  const input = {
    businessName: cleanText(body.businessName, 120),
    businessDescription: cleanText(body.businessDescription, 4000),
    location: cleanText(body.location, 120),
    tone: cleanText(body.tone, 120),
    goal: cleanText(body.goal, 180),
    audience: cleanText(body.audience, 500),
    projectId: cleanText(body.projectId, 120),
    userId: cleanText(body.userId, 120)
  };

  if (!input.businessName || !input.businessDescription) {
    return jsonResponse({ error: "Business name and description are required." }, 400);
  }

  const prompt = `
Create a first-draft small business website for the PBI builder.

Business name: ${input.businessName}
Business description: ${input.businessDescription}
Location: ${input.location || "Not provided"}
Preferred tone: ${input.tone || "friendly and professional"}
Main website goal: ${input.goal || "get enquiries"}
Target audience: ${input.audience || "Not provided"}

Rules:
- Use UK English.
- Write practical, editable website content.
- Do not invent awards, reviews, certifications, years of experience, guarantees, regulated claims, or exact prices unless supplied.
- Keep the content suitable for a small UK business.
- Make the draft useful enough to preview immediately.
- The primary button action type must be one of: enquiry_form, booking_link, phone_call, email, internal_page.
- If no button target is known, use enquiry_form with target "/enquiry".
- Include custom-build and assisted-setup prompts that PBI can use to upsell services without being pushy.
`;

  const ai = await callOpenAIJson(env, {
    system: "You are the PBI Website Assistant. Return only valid JSON matching the schema.",
    prompt,
    schemaName: "pbi_website_draft",
    schema: websiteDraftSchema(),
    temperature: 0.45
  });

  if (!ai.ok) return ai.response;

  const draftId = makeId("draft");
  const createdAt = nowIso();

  if (env.DB) {
    await env.DB.prepare(`
      INSERT INTO ai_website_drafts (
        id, project_id, user_id, business_name, business_description, location, tone, goal, audience, generated_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      draftId,
      input.projectId || null,
      input.userId || null,
      input.businessName,
      input.businessDescription,
      input.location || null,
      input.tone || null,
      input.goal || null,
      input.audience || null,
      JSON.stringify(ai.data),
      createdAt,
      createdAt
    ).run();
  }

  return jsonResponse({ success: true, draftId, website: ai.data });
}
