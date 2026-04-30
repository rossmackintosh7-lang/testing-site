export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders }
  });
}
export async function readJson(request) { try { return await request.json(); } catch { return {}; } }
export function requireMethod(request, method) { return request.method === method ? null : jsonResponse({ error: `Method not allowed. Use ${method}.` }, 405); }
export function cleanText(value, max = 3000) { return (!value || typeof value !== "string") ? "" : value.trim().slice(0, max); }
export function makeId(prefix = "id") { return `${prefix}_${crypto.randomUUID()}`; }
export function nowIso() { return new Date().toISOString(); }
export function safeJsonParse(value, fallback = null) { try { return JSON.parse(value); } catch { return fallback; } }
