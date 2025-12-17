type Env = { DB: D1Database };

const json = (status: number, data: unknown) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeRiskFromPercent(pct: number) {
  return pct >= 75 ? "low" : pct >= 40 ? "medium" : "high";
}

function computeScores(answerMap: Map<string, string>) {
  const get = (k: string) => (answerMap.get(k) ?? "").toString();

  // --- VPN (0..2)
  let vpn = 0;

  const vpnInUse = get("vpn_in_use");
  if (vpnInUse === "yes") vpn += 0.5;

  const vpnTech = get("vpn_technology");
  if (vpnTech === "wireguard" || vpnTech === "ipsec") vpn += 0.75;
  else if (vpnTech === "sslvpn") vpn += 0.35;
  else if (vpnTech === "pptp") vpn += 0.0;

  const vpnSol = get("vpn_solution");
  if (vpnSol === "zero_trust" || vpnSol === "ztna") vpn += 0.75;
  else if (vpnSol === "firewall_vpn" || vpnSol === "vpn_gateway") vpn += 0.45;

  const sat = get("remote_access_satisfaction");
  if (sat === "satisfied") vpn += 0.25;
  else if (sat === "neutral") vpn += 0.1;
  else if (sat === "unsatisfied") vpn += 0.0;

  const users = get("vpn_users");
  if (users === "less_than_10") vpn += 0.15;
  else if (users === "10_49") vpn += 0.1;
  else if (users) vpn += 0.05;

  const score_vpn = clamp(Math.round(vpn * 100) / 100, 0, 2);

  // --- WEB (0..3)
  let web = 0;

  const critical = get("critical_processes_on_website"); // yes/no
  const hosting = get("hosting_type");
  const protection = get("web_protection");
  const incidents = get("security_incidents"); // yes/no

  if (hosting === "managed_hosting") web += 0.5;
  else if (hosting === "cloud" || hosting === "saas") web += 0.7;
  else if (hosting) web += 0.25;

  if (protection === "none") web += 0.0;
  else if (protection === "basic") web += 0.75;
  else if (protection === "waf") web += 1.6;
  else if (protection === "waf_ddos" || protection === "waf+ddos") web += 2.2;
  else if (protection) web += 1.0;

  if (critical === "yes" && protection === "none") web -= 0.8;
  if (incidents === "yes") web -= 0.7;

  const score_web = clamp(Math.round(web * 100) / 100, 0, 3);

  // --- AWARENESS (0..2)
  let aw = 0;

  const training = get("awareness_training"); // yes/partially/no
  const resil = get("infrastructure_resilience"); // high/medium/low
  const dmg = get("financial_damage_risk"); // buckets

  if (training === "yes") aw += 0.9;
  else if (training === "partially") aw += 0.45;

  if (resil === "high") aw += 0.7;
  else if (resil === "medium") aw += 0.35;

  if (dmg === "less_than_5k") aw += 0.4;
  else if (dmg === "5k_to_25k") aw += 0.2;
  else if (dmg) aw += 0.0;

  const score_awareness = clamp(Math.round(aw * 100) / 100, 0, 2);

  const maxTotal = 2 + 3 + 2; // 7
  const totalPoints = score_vpn + score_web + score_awareness;
  const score_total = clamp(Math.round((totalPoints / maxTotal) * 100), 0, 100);

  const risk_level = normalizeRiskFromPercent(score_total);

  return { score_total, score_vpn, score_web, score_awareness, risk_level };
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const leadId = (params as any)?.leadId as string | undefined;
  if (!leadId) return json(400, { ok: false, error: "Missing leadId" });

  try {
    const leadRes = await env.DB
      .prepare(`SELECT * FROM leads WHERE id = ? LIMIT 1`)
      .bind(leadId)
      .all();

    const lead = ((leadRes as any).results?.[0] ?? null) as any;
    if (!lead) return json(404, { ok: false, error: "Not found", message: "Lead not found" });

    const ansRes = await env.DB
      .prepare(`SELECT id, lead_id, question_key, answer_value FROM lead_answers WHERE lead_id = ? ORDER BY rowid ASC`)
      .bind(leadId)
      .all();

    const answers = (((ansRes as any).results ?? []) as any[]).map((a) => ({
      id: a.id ?? `${a.lead_id}:${a.question_key}`,
      lead_id: a.lead_id,
      question_key: a.question_key,
      answer_value: a.answer_value,
    }));

    const answerMap = new Map<string, string>();
    for (const a of answers) answerMap.set(a.question_key, a.answer_value);

    const scores = computeScores(answerMap);

    return json(200, { ok: true, item: { lead, answers, scores } });
  } catch (e: any) {
    return json(500, { ok: false, error: "Result fetch failed", message: e?.message ?? String(e) });
  }
};
