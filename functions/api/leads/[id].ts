 (vpnTech === "sslvpn") vpn += 0.35;
   else if (vpnTech) vpn += 0.05;
   
     const vpnSol = get("vpn_solution");
       if (vpnSol === "zero_trust" || vpnSol === "ztna") vpn += 0.75;
         else if (vpnSol === "firewall_vpn" || vpnSol === "vpn_gateway") vpn += 0.45;
           else if (vpnSol) vpn += 0.05;
           
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
                                   const protection = ge// functions/api/leads/[id].ts
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
  else ift("web_protection");
  const incidents = get("security_incidents");

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

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env, params } = ctx;
  const leadId = (params as any)?.id as string | undefined;
  if (!leadId) return new Response("Missing id", { status: 400 });

  // GET /api/leads/:id  -> Detail inkl. Answers + Scores
  if (request.method === "GET") {
    const leadRes = await env.DB.prepare(`SELECT * FROM leads WHERE id = ? LIMIT 1`).bind(leadId).all();
    const lead = (leadRes as any).results?.[0] ?? null;
    if (!lead) return new Response("Not found", { status: 404 });

    const ansRes = await env.DB
      .prepare(`SELECT id, lead_id, question_key, answer_value FROM lead_answers WHERE lead_id = ? ORDER BY rowid ASC`)
      .bind(leadId)
      .all();

    const answers = ((ansRes as any).results ?? []).map((a: any) => ({
      id: a.id,
      lead_id: a.lead_id,
      question_key: a.question_key,
      answer_value: a.answer_value,
    }));

    const scores = computeScoresFromAnswers(
      answers.map((a: any) => ({ question_key: a.question_key, answer_value: a.answer_value }))
    );

    // Optional: risk_level im lead für Frontend direkt verfügbar machen
    const outLead = { ...lead, risk_level: scores.risk_level };

    return new Response(JSON.stringify({ lead: outLead, answers, scores }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // POST /api/leads/:id  -> Status persistieren (new/done)
  if (request.method === "POST") {
    const body = await readJson(request);
    const status = body?.status;

    if (status !== "new" && status !== "done") {
      return new Response(JSON.stringify({ ok: false, error: "Invalid status" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    await env.DB.prepare(`UPDATE leads SET status = ? WHERE id = ?`).bind(status, leadId).run();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
