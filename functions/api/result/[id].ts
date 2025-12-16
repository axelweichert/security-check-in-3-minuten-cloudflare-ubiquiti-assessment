export interface Env {
  DB: D1Database;
}

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const id = String((params as any).id || "");
  if (!id) return j(400, { ok: false, error: "Missing id" });

  try {
    // lead: NUR das, was ResultPage braucht (keine Admin-PII wie Email/Telefon)
    const lead = await env.DB.prepare(
      `SELECT id, created_at, language, company_name, employee_range,
              firewall_vendor, vpn_technology, zero_trust_vendor
       FROM leads WHERE id = ? LIMIT 1`
    ).bind(id).first<any>();

    if (!lead) return j(404, { ok: false, error: "Lead not found" });

    const answers = await env.DB.prepare(
      `SELECT id, lead_id, question_key, answer_value, created_at
       FROM lead_answers WHERE lead_id = ?
       ORDER BY created_at ASC`
    ).bind(id).all<any>();

    // scores optional – falls Tabelle/Row fehlt, liefern wir ein Default-Objekt damit UI nicht crasht
    let scores = null as any;
    try {
      scores = await env.DB.prepare(`SELECT * FROM lead_scores WHERE lead_id = ? LIMIT 1`).bind(id).first<any>();
    } catch (_) {
      scores = null;
    }

    if (!scores) {
      scores = {
        lead_id: id,
        risk_level: "medium",
        vpn_score: 0,
        web_score: 0,
        awareness_score: 0,
        total_score: 0,
      };
    }

    return j(200, { ok: true, item: { lead, answers: answers?.results ?? [], scores } });
  } catch (e: any) {
    // Cloudflare 1101 vermeiden: immer JSON zurückgeben
    return j(500, { ok: false, error: "Result fetch failed", message: String(e?.message || e) });
  }
};
