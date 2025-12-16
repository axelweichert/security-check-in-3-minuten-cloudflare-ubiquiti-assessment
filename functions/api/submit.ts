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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json(500, { ok: false, error: "DB binding missing (expected env.DB)" });

    let body: LeadInput;
    try {
      body = (await request.json()) as LeadInput;
    } catch (e) {
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    if (!body.company_name || !body.contact_name || !body.email) {
      return json(400, { ok: false, error: "Missing required fields: company_name, contact_name, email" });
    }

    const now = new Date().toISOString();
    const leadId = crypto.randomUUID();

    // IMPORTANT: if this throws, we will now SEE the real SQLite/D1 error.
await env.DB.prepare(
  `INSERT INTO leads (id, company_name, contact_name, email, phone, employee_range,
                      firewall_vendor, vpn_technology, zero_trust_vendor,
                      consent_contact, consent_tracking, discount_opt_in,
                      created_at, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).bind(
  leadId,
  body.company_name,
  body.contact_name,
  body.email,
  body.phone ?? null,
  body.employee_range ?? null,
  body.firewall_vendor ?? null,
  body.vpn_technology ?? null,
  body.zero_trust_vendor ?? null,
  body.consent_contact ? 1 : 0,
  body.consent_tracking ? 1 : 0,
  body.discount_opt_in ? 1 : 0,
  now,
  "new"
).run();

    await env.DB.prepare(
      `INSERT INTO leads (id, company_name, contact_name, email, phone, employee_range,
                          firewall_vendor, vpn_technology, zero_trust_vendor,
                          consent_contact, consent_tracking, discount_opt_in,
                          created_at, updated_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      leadId,
      body.company_name,
      body.contact_name,
      body.email,
      body.phone ?? null,
      body.employee_range ?? null,
      body.firewall_vendor ?? null,
      body.vpn_technology ?? null,
      body.zero_trust_vendor ?? null,
      body.consent_contact ? 1 : 0,
      body.consent_tracking ? 1 : 0,
      body.discount_opt_in ? 1 : 0,
      now,
      now,
      "new"
    ).run();
    }

    return json(200, { ok: true, lead_id: leadId });
  } catch (err: any) {
    // This prevents Cloudflare 1101 and shows the actual cause.
    console.error("submit error:", err);
    return json(500, {
      ok: false,
      error: "Submit failed",
      message: String(err?.message ?? err),
      name: err?.name,
      // stack is helpful during setup; you can remove later
      stack: err?.stack,
    });
  }
};

