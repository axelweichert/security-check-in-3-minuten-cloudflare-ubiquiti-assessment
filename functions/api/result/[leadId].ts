export async function onRequestGet({ params, env }: any) {
  const json = (status: number, body: any) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });

  try {
    const leadId = String(params?.leadId || "").trim();
    if (!leadId) return json(400, { ok: false, error: "Missing leadId" });

    const db =
      (env as any).DB ||
      (env as any).D1 ||
      (env as any).DATABASE ||
      (env as any).SECURITYCHECK_DB;

    if (!db) return json(500, { ok: false, error: "Missing D1 binding (DB)" });

    const lead = await db
      .prepare(
        `SELECT
          id, language, company_name, contact_name, employee_range,
          email, phone, firewall_vendor, vpn_technology, zero_trust_vendor,
          consent_contact, consent_tracking, discount_opt_in, status, done_at, risk_level
        FROM leads
        WHERE id = ?1
        LIMIT 1`
      )
      .bind(leadId)
      .first();

    if (!lead) return json(404, { ok: false, error: "Lead not found" });

    const answersRes = await db
      .prepare(
        `SELECT id, lead_id, question_key, answer_value
         FROM lead_answers
         WHERE lead_id = ?1
         ORDER BY id ASC`
      )
      .bind(leadId)
      .all();

    const answers = (answersRes?.results || []) as any[];

    const scores = { risk_level: (lead as any).risk_level || "medium" };

    return json(200, { ok: true, item: { lead, answers, scores } });
  } catch (e: any) {
    return json(500, { ok: false, error: "Result fetch failed", message: e?.message || String(e) });
  }
}
