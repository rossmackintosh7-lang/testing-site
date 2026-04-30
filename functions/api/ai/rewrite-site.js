import { json, error, readBody, getUserFromSession } from '../projects/_shared.js';

function stripJsonFence(value) {
  return String(value || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

export async function onRequestPost({ request, env }) {
  const user = await getUserFromSession(env, request);

  if (!user) {
    return error('Unauthorized.', 401);
  }

  if (!env.OPENAI_API_KEY) {
    return error('AI wording is not connected yet. Add OPENAI_API_KEY in Cloudflare Pages environment variables.', 501);
  }

  const body = await readBody(request);

  const selectedPages =
    Array.isArray(body.selected_pages) && body.selected_pages.length
      ? body.selected_pages
      : ['home', 'about', 'services', 'contact'];

  const prompt = `
You are writing website copy for a small/local business website builder called PBI.

Return ONLY valid JSON. No markdown. No commentary.

The user brief:
${body.brief || ''}

Business name:
${body.business_name || ''}

Preferred tone:
${body.tone || 'professional and friendly'}

Selected pages:
${selectedPages.join(', ')}

Create concise, professional website copy and distribute it across the selected pages.

JSON shape:
{
  "business_name": "only if obvious, otherwise empty string",
  "page_main_heading": "clear homepage hero heading",
  "sub_heading": "short homepage intro paragraph",
  "pages": {
    "home": {"title": "...", "body": "..."},
    "about": {"title": "...", "body": "..."},
    "services": {"title": "...", "body": "..."},
    "gallery": {"title": "...", "body": "..."},
    "contact": {"title": "...", "body": "..."}
  }
}

Rules:
- Only include page keys that are in the selected pages list.
- Keep wording clear and simple.
- Do not invent precise addresses, phone numbers, awards, accreditations or claims.
- Use UK English spelling.
- Avoid robotic AI phrases.
- Keep body text between 35 and 90 words per page.
`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-5.5-mini',
      input: prompt
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return error(result.error?.message || 'AI wording request failed.', 500);
  }

  const text =
    result.output_text ||
    result.output?.flatMap((item) => item.content || [])
      ?.map((content) => content.text || '')
      ?.join('\n') ||
    '';

  let copy;

  try {
    copy = JSON.parse(stripJsonFence(text));
  } catch {
    return error('AI returned wording, but it was not valid JSON. Try again.', 500);
  }

  return json({
    ok: true,
    copy
  });
}

export async function onRequestGet() {
  return error('Method not allowed.', 405);
}
