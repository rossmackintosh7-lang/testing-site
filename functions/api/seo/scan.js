import { jsonResponse } from "../_lib/http.js";
import { scanSeo, isManualRequestAllowed } from "../_lib/seo.js";

export async function onRequestPost(context) {
  if (!isManualRequestAllowed(context.request, context.env)) return jsonResponse({ error: "Admin token required." }, 401);
  const result = await scanSeo(context.env, context.request);
  return jsonResponse({ success: true, message: "SEO scan complete.", ...result });
}

export async function onRequestGet(context) {
  if (!isManualRequestAllowed(context.request, context.env)) return jsonResponse({ error: "Admin token required." }, 401);
  const result = await scanSeo(context.env, context.request);
  return jsonResponse({ success: true, message: "SEO scan complete.", ...result });
}
