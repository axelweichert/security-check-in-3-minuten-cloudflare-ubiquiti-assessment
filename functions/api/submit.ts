type LeadInput = {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  employee_range?: string;

  firewall_vendor?: string;
  vpn_technology?: string;
  zero_trust_vendor?: string;

  consent_contact?: boolean;
  consent_tracking?: boolean;
  discount_opt_in?: boolean;

  answers?: Record<string, unknown>;
  score?: {
    total: number;
    percent: number;
    rating: "low" | "medium" | "high";
    breakdown?: Record<string, unknown>;
  };
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const onRequestGet: PagesFunction<Env> = async () => {
  // Make browser calls non-confusing (instead of 404)
  return json(405, { ok: false, error: "Method Not Allowed. Use POST /api/submit" });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return json(500, { ok: false, error: "DB binding missing (expected env.DB)" });

  let body: LeadInput;
  try {
    body = (await request.json()) as LeadInput;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  if (!body.company_name || !body.contact_name || !body.email) {
    return json(400, { ok: false, error: "Missing required fields: company_name, contact_name, email" });
  }

  const now = new Date().toISOString();
  const leadId = crypto.randomUUID();

  try {
    // IMPORTANT: updated_at is NOT in your schema, so do not reference it.
const lang =
  (body as any).language ??
  (request.headers.get("accept-language")?.toLowerCase().startsWith("fr")
    ? "fr"
    : request.headers.get("accept-language")?.toLowerCase().startsWith("en")
      ? "en"
      : "de");

await env.DB.prepare(
  `INSERT INTO leads (id, company_name, contact_name, email, phone, employee_range,
                      firewall_vendor, vpn_technology, zero_trust_vendor,
                      consent_contact, consent_tracking, discount_opt_in,
                      created_at, status, language)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
)
  .bind(
    leadId,
    body.company_name,
    body.contact_name,
    body.email,
    (body.phone && body.phone.trim().length > 0) ? body.phone.trim() : "n/a",
    body.employee_range ?? "unknown",
    body.firewall_vendor ?? null,
    body.vpn_technology ?? null,
    body.zero_trust_vendor ?? null,
    body.consent_contact ? 1 : 0,
    body.consent_tracking ? 1 : 0,
    body.discount_opt_in ? 1 : 0,
    now,
    "new",
    lang
  )
  .run();
    if (body.answers && typeof body.answers === "object") {
      for (const [question, answer] of Object.entries(body.answers)) {
        await env.DB.prepare(
          `INSERT INTO lead_answers (lead_id, question_key, answer_value, created_at)
           VALUES (?, ?, ?, ?)`
        )
          .bind(
            leadId,
            question,
            typeof answer === "string" ? answer : JSON.stringify(answer),
            now
          )
          .run();
      }
    }

    if (body.score) {
      await env.DB.prepare(
        `INSERT INTO lead_scores (lead_id, total, percent, rating, breakdown_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(
          leadId,
          body.score.total ?? 0,
          body.score.percent ?? 0,
          body.score.rating ?? "medium",
          JSON.stringify(body.score.breakdown ?? {}),
          now
        )
        .run();
    }

    return json(200, { ok: true, lead_id: leadId });
  } catch (err: any) {
    console.error("submit error:", err);
    return json(500, {
      ok: false,
      error: "Submit failed",
      message: String(err?.message ?? err),
      name: err?.name,
    });
  }
};
