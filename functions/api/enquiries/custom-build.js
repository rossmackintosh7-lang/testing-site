import { jsonResponse, readJson, requireMethod, cleanText, makeId, nowIso } from "../_lib/http.js";

export async function onRequestPost(context) {
  const methodError = requireMethod(context.request, "POST");
  if (methodError) return methodError;

  const { env, request } = context;
  const body = await readJson(request);

  const enquiry = {
    id: makeId("enq"),
    name: cleanText(body.name, 120),
    email: cleanText(body.email, 180),
    businessName: cleanText(body.businessName, 180),
    phone: cleanText(body.phone, 80),
    budget: cleanText(body.budget, 80),
    timeframe: cleanText(body.timeframe, 120),
    needs: cleanText(body.needs, 5000),
    projectId: cleanText(body.projectId, 120),
    source: cleanText(body.source, 120) || "pbi_agent",
    createdAt: nowIso()
  };

  if (!enquiry.name || !enquiry.email || !enquiry.needs) {
    return jsonResponse({ error: "Name, email and enquiry details are required." }, 400);
  }

  if (env.DB) {
    await env.DB.prepare(`
      INSERT INTO pbi_custom_build_enquiries (
        id, project_id, name, email, business_name, phone, budget, timeframe, needs, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      enquiry.id,
      enquiry.projectId || null,
      enquiry.name,
      enquiry.email,
      enquiry.businessName || null,
      enquiry.phone || null,
      enquiry.budget || null,
      enquiry.timeframe || null,
      enquiry.needs,
      enquiry.source,
      enquiry.createdAt
    ).run();
  }

  if (env.RESEND_API_KEY && env.CUSTOM_BUILD_NOTIFY_TO && env.CUSTOM_BUILD_NOTIFY_FROM) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.CUSTOM_BUILD_NOTIFY_FROM,
        to: [env.CUSTOM_BUILD_NOTIFY_TO],
        subject: `New PBI custom build enquiry: ${enquiry.businessName || enquiry.name}`,
        text: `Name: ${enquiry.name}\nEmail: ${enquiry.email}\nBusiness: ${enquiry.businessName || "Not provided"}\nPhone: ${enquiry.phone || "Not provided"}\nBudget: ${enquiry.budget || "Not provided"}\nTimeframe: ${enquiry.timeframe || "Not provided"}\nProject ID: ${enquiry.projectId || "Not provided"}\n\nNeeds:\n${enquiry.needs}`
      })
    }).catch(error => console.error("Resend failed:", error));
  }

  return jsonResponse({ success: true, enquiryId: enquiry.id, message: "Custom build enquiry received." });
}
