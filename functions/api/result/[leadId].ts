type Env = { DB: D1Database };

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

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

function computeFallbackScores(answerMap: Map<string, string>) {
  const score_vpn = Math.min(2, ANSWER_GROUPS.vpn.reduce((acc, k) => acc + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0));
  const score_web = Math.min(3, ANSWER_GROUPS.web.reduce((acc, k) => acc + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0));
  const score_awareness = Math.min(2, ANSWER_GROUPS.awareness.reduce((acc, k) => acc + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0));

  const maxTotal = 2 + 3 + 2;
  const totalPoints = score_vpn + score_web + score_awareness;
  const score_total = Math.round((totalPoints / maxTotal) * 100);
  const risk_level = normalizeRiskFromPercent(score_total);

  return { score_total, score_vpn, score_web, score_awareness, risk_level };
}

function safeParseJson<T = any>(s: unknown): T | null {
  try {
    if (typeof s !== "string") return null;
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function normalizeRiskFromPercent(pct: number) {
  return pct >= 75 ? "low" : pct >= 40 ? "medium" : "high";
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const leadId = (params as any)?.leadId as string | undefined;
  if (!leadId) return json(400, { ok: false, error: "Missing leadId" });

  try {
    const leadRes = await env.DB.prepare(`SELECT * FROM leads WHERE id = ? LIMIT 1`).bind(leadId).all();
    const lead = ((leadRes as any).results?.[0] ?? null) as any;
    if (!lead) return json(404, { ok: false, error: "Not found", message: "Lead not found" });

    // answers
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

    const fallback = computeFallbackScores(answerMap);

    // Prefer persisted lead_scores if present
    let scores = fallback;
    try {
      const scoreRes = await env.DB
        .prepare(`SELECT * FROM lead_scores WHERE lead_id = ? ORDER BY rowid DESC LIMIT 1`)
        .bind(leadId)
        .all();

      const row = ((scoreRes as any).results?.[0] ?? null) as any;
      if (row) {
        const pctRaw = row.percent ?? row.score_total ?? row.total ?? row.score ?? null;
        const pct = typeof pctRaw === "number" ? pctRaw : Number(pctRaw);

        const breakdown = safeParseJson<any>(row.breakdown_json ?? row.breakdown ?? null) ?? {};
        const vpn = Number(breakdown.score_vpn ?? breakdown.vpn ?? breakdown.vpn_score ?? fallback.score_vpn);
        const web = Number(breakdown.score_web ?? breakdown.web ?? breakdown.web_score ?? fallback.score_web);
        const awareness = Number(breakdown.score_awareness ?? breakdown.awareness ?? breakdown.awareness_score ?? fallback.score_awareness);

        if (Number.isFinite(pct)) {
          const riskRaw = row.rating ?? row.risk_level;
          const risk = riskRaw ? String(riskRaw) : normalizeRiskFromPercent(pct);

          scores = {
            score_total: Math.max(0, Math.min(100, Math.round(pct))),
            score_vpn: Number.isFinite(vpn) ? vpn : fallback.score_vpn,
            score_web: Number.isFinite(web) ? web : fallback.score_web,
            score_awareness: Number.isFinite(awareness) ? awareness : fallback.score_awareness,
            risk_level: (risk === "low" || risk === "medium" || risk === "high") ? risk : normalizeRiskFromPercent(pct),
          };
        }
      }
    } catch {
      // keep fallback if lead_scores doesn't exist or query fails
    }

    return json(200, { ok: true, item: { lead, answers, scores } });
  } catch (e: any) {
    return json(500, { ok: false, error: "Result fetch failed", message: e?.message ?? String(e) });
  }
};
