type Env = { DB: D1Database };

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

const ANSWER_GROUPS = {
  vpn: ["vpn_in_use", "vpn_solution", "vpn_users", "vpn_technology", "remote_access_satisfaction"],
  web: ["critical_processes_on_website", "hosting_type", "web_protection", "security_incidents"],
  awareness: ["awareness_training", "infrastructure_resilience", "financial_damage_risk"],
} as const;

function isMeaningful(v: string | null | undefined) {
  const s = (v ?? "").toString().trim().toLowerCase();
  if (!s) return false;
  if (["unknown", "dont_know", "n/a", "na", "none"].includes(s)) return false;
  return true;
}

function computeScores(answerMap: Map<string, string>) {
  const score_vpn = Math.min(
    2,
    ANSWER_GROUPS.vpn.reduce((acc, k) => acc + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0)
  );
  const score_web = Math.min(
    3,
    ANSWER_GROUPS.web.reduce((acc, k) => acc + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0)
  );
  const score_awareness = Math.min(
    2,
    ANSWER_GROUPS.awareness.reduce((acc, k) => acc + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0)
  );

  const maxTotal = 2 + 3 + 2;
  const totalPoints = score_vpn + score_web + score_awareness;
  const score_total = Math.round((totalPoints / maxTotal) * 100);

  const risk_level = score_total >= 75 ? "low" : score_total >= 40 ? "medium" : "high";

  return { score_total, score_vpn, score_web, score_awareness, risk_level };
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const leadId = (params as any)?.leadId as string | undefined;
  if (!leadId) return json(400, { ok: false, error: "Missing leadId" });

  try {
    const leadRes = await env.DB.prepare(`SELECT * FROM leads WHERE id = ? LIMIT 1`).bind(leadId).all();
    const lead = ((leadRes as any).results?.[0] ?? null) as any;
    if (!lead) return json(404, { ok: false, error: "Not found", message: "Lead not found" });

    const ansRes = await env.DB
      .prepare(`SELECT id, lead_id, question_key, answer_value, created_at FROM lead_answers WHERE lead_id = ? ORDER BY created_at ASC`)
      .bind(leadId)
      .all();
    const answers = (((ansRes as any).results ?? []) as any[]).map((a) => ({
      id: a.id ?? `${a.lead_id}:${a.question_key}`,
      lead_id: a.lead_id,
      question_key: a.question_key,
      answer_value: a.answer_value,
      created_at: a.created_at,
    }));

    const answerMap = new Map<string, string>();
    for (const a of answers) answerMap.set(a.question_key, a.answer_value);

    const scores = computeScores(answerMap);

    return json(200, { ok: true, item: { lead, answers, scores } });
  } catch (e: any) {
    return json(500, { ok: false, error: "Result fetch failed", message: e?.message ?? String(e) });
  }
};
