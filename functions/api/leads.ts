export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const status = url.searchParams.get("status");
    const risk = url.searchParams.get("risk");
    const discount = url.searchParams.get("discount");

    const conditions: string[] = [];
    const binds: any[] = [];

    if (from) {
      conditions.push("datetime(created_at) >= datetime(?)");
      binds.push(from);
    }
    if (to) {
      conditions.push("datetime(created_at) <= datetime(?)");
      binds.push(to);
    }
    if (status && status !== "all") {
      conditions.push("status = ?");
      binds.push(status);
    }
    if (discount && discount !== "all") {
      conditions.push("discount_opt_in = ?");
      binds.push(discount === "yes" ? 1 : 0);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const leadsRes = await env.DB.prepare(
      `SELECT id, company_name, created_at, status, discount_opt_in FROM leads ${where} ORDER BY created_at DESC LIMIT 500`
    )
      .bind(...binds)
      .all();

    const leads = ((leadsRes as any).results ?? []) as any[];

    if (leads.length === 0) {
      return new Response(JSON.stringify({ ok: true, items: [] }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    // --- Antworten für alle Leads in einem Rutsch holen
    const ids = leads.map((l) => l.id);
    const placeholders = ids.map(() => "?").join(",");

    const ansRes = await env.DB.prepare(
      `SELECT lead_id, question_key, answer_value
       FROM lead_answers
       WHERE lead_id IN (${placeholders})`
    )
      .bind(...ids)
      .all();

    const rows = ((ansRes as any).results ?? []) as any[];
    const byLead = new Map<string, { question_key: string; answer_value: any }[]>();

    for (const r of rows) {
      const lid = String(r.lead_id ?? "");
      if (!byLead.has(lid)) byLead.set(lid, []);
      byLead.get(lid)!.push({ question_key: String(r.question_key ?? ""), answer_value: r.answer_value });
    }

    // --- Score/Risk berechnen
    const items = leads.map((l) => {
      const lid = String(l.id);
      const answers = byLead.get(lid) ?? [];
      const scores = computeScoresFromAnswers(answers);
      return {
        ...l,
        risk_level: scores.risk_level,
      };
    });

    // Risk-Filter nach Berechnung anwenden
    const filtered = risk && risk !== "all" ? items.filter((x) => x.risk_level === risk) : items;

    return new Response(JSON.stringify({ ok: true, items: filtered }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    return new Response(JSON.stringify({ ok: false, error: "Failed to list leads", message: msg }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};

// --------------------
// Scoring (identisch zur Logik, die ihr fürs Ergebnis nutzt)
// --------------------

type Env = { DB: D1Database };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeRiskFromPercent(pct: number) {
  return pct >= 75 ? "low" : pct >= 40 ? "medium" : "high";
}

function computeScoresFromAnswers(items: { question_key: string; answer_value: any }[]) {
  const m = new Map<string, string>();
  for (const a of items) m.set(String(a.question_key ?? ""), String(a.answer_value ?? ""));
  const get = (k: string) => (m.get(k) ?? "").toString();

  let vpn = 0;
  const vpnInUse = get("vpn_in_use");
  if (vpnInUse === "yes") vpn += 0.5;

  const vpnTech = get("vpn_technology");
  if (vpnTech === "wireguard" || vpnTech === "ipsec") vpn += 0.75;
  else if (vpnTech === "sslvpn") vpn += 0.35;
  else if (vpnTech === "openvpn") vpn += 0.35;

  const vpnSol = get("vpn_solution");
  if (vpnSol === "zero_trust" || vpnSol === "ztna") vpn += 0.75;
  else if (vpnSol === "firewall_vpn" || vpnSol === "vpn_gateway") vpn += 0.45;

  const sat = get("remote_access_satisfaction");
  if (sat === "satisfied") vpn += 0.25;
  else if (sat === "neutral") vpn += 0.1;

  const users = get("vpn_users");
  if (users === "less_than_10") vpn += 0.15;
  else if (users === "10_49") vpn += 0.1;
  else if (users) vpn += 0.05;

  const score_vpn = clamp(Math.round(vpn * 100) / 100, 0, 2);

  let web = 0;
  const critical = get("critical_processes_on_website");
  const hosting = get("hosting_type");
  const protection = get("web_protection");
  const incidents = get("security_incidents");

  if (hosting === "managed_hosting") web += 0.5;
  else if (hosting === "cloud" || hosting === "saas") web += 0.7;
  else if (hosting) web += 0.25;

  if (protection === "none") web += 0.0;
  else if (protection === "basic") web += 0.75;
  else if (protection === "waf") web += 1.6;
  else if (protection === "waf_ddos" || protection === "waf+ddos") web += 2.2;
  else if (protection === "ddos_protection") web += 1.2;
  else if (protection) web += 1.0;

  if (critical === "yes" && protection === "none") web -= 0.8;
  if (incidents === "yes") web -= 0.7;

  const score_web = clamp(Math.round(web * 100) / 100, 0, 3);

  let aw = 0;
  const training = get("awareness_training");
  const resil = get("infrastructure_resilience");
  const dmg = get("financial_damage_risk");

  if (training === "yes") aw += 0.9;
  else if (training === "partially") aw += 0.45;

  if (resil === "high") aw += 0.7;
  else if (resil === "medium") aw += 0.35;

  if (dmg === "less_than_5k") aw += 0.4;
  else if (dmg === "5k_to_25k") aw += 0.2;

  const score_awareness = clamp(Math.round(aw * 100) / 100, 0, 2);

  const score_total = clamp(Math.round(((score_vpn + score_web + score_awareness) / 7) * 100), 0, 100);
  const risk_level = normalizeRiskFromPercent(score_total);

  return { score_total, score_vpn, score_web, score_awareness, risk_level };
}
