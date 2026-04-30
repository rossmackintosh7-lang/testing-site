import { jsonResponse } from "./http.js";

export async function callOpenAIJson(env, { system, prompt, schema, schemaName = "pbi_response", temperature = 0.4 }) {
  if (!env.OPENAI_API_KEY) {
    return { ok: false, response: jsonResponse({ error: "OPENAI_API_KEY is missing from Cloudflare Variables and Secrets." }, 500) };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [{ role: "system", content: system }, { role: "user", content: prompt }],
      text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
      temperature
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, response: jsonResponse({ error: "AI request failed.", details: data.error?.message || "Check API key, billing, model and request format." }, 500) };
  }

  const outputText = typeof data.output_text === "string"
    ? data.output_text
    : (data.output || []).flatMap(item => item.content || []).filter(part => part.type === "output_text").map(part => part.text).join("").trim();

  if (!outputText) return { ok: false, response: jsonResponse({ error: "AI returned an empty response." }, 500) };

  try { return { ok: true, data: JSON.parse(outputText), raw: data }; }
  catch { return { ok: false, response: jsonResponse({ error: "AI returned invalid JSON." }, 500) }; }
}
