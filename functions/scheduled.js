import { jsonResponse } from "./api/_lib/http.js";
import { scanSeo, isManualRequestAllowed } from "./api/_lib/seo.js";

export async function onScheduled(event, env, ctx) {
  ctx.waitUntil(scanSeo(env, new Request(env.PBI_BASE_URL || "https://www.purbeckbusinessinnovations.co.uk/")));
}

export async function onRequest(context) {
  if (!isManualRequestAllowed(context.request, context.env)) return jsonResponse({ error: "Admin token required." }, 401);
  const result = await scanSeo(context.env, context.request);
  return jsonResponse({ success: true, message: "Scheduled SEO scan ran manually.", report: result.report, pages: result.pages });
}
