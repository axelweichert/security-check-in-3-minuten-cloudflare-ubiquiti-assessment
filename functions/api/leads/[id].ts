type Env = { DB: D1Database };

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const leadId = (params as any)?.id as string | undefined;
  if (!leadId) return json({ ok: false, error: "Missing id" }, 400);

  try {
    const leadRes = await env.DB.prepare(`SELECT * FROM leads WHERE id = ? LIMIT 1`).bind(leadId).all();
    const lead = ((leadRes as any).results?.[0] ?? null) as any;
    if (!lead) return json({ ok: false, error: "Not found" }, 404);

    const ansRes = await env.DB
      .prepare(`SELECT id, lead_id, question_key, answer_value, created_at FROM lead_answers WHERE lead_id = ? ORDER BY rowid ASC`)
      .bind(leadId)
      .all();

    const answers = (((ansRes as any).results ?? []) as any[]).map((a) => ({
      id: a.id,
      lead_id: a.lead_id,
      question_key: a.question_key,
      answer_value: a.answer_value,
      created_at: a.created_at,
    }));

    const scores = computeScoresFromAnswers(answers);

    return json({ ok: true, item: { lead, answers, scores } }, 200);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    return json({ ok: false, error: "Failed to load lead", message: msg }, 500);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  const leadId = (params as any)?.id as string | undefined;
  if (!leadId) return json({ ok: false, error: "Missing id" }, 400);

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const status = String(body?.status ?? "");

    if (status !== "new" && status !== "done") {
      return json({ ok: false, error: "Invalid status", message: "status must be 'new' or 'done'" }, 400);
    }

    if (status === "done") {
      await env.DB.prepare(`UPDATE leads SET status = ?, done_at = datetime('now') WHERE id = ?`).bind("done", leadId).run();
    } else {
      await env.DB.prepare(`UPDATE leads SET status = ?, done_at = NULL WHERE id = ?`).bind("new", leadId).run();
    }

    return json({ ok: true }, 200);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    return json({ ok: false, error: "Failed to update status", message: msg }, 500);
  }
};

// --------------------
// helpers
// --------------------

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

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
