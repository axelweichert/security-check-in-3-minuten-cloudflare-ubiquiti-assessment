import type { PagesFunction } from '@cloudflare/workers-types';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

type RiskLevel = 'low' | 'medium' | 'high';

function calcScores(answerMap: Map<string, string>) {
  let score_vpn = 0;
  let score_web = 0;
  let score_awareness = 0;

  // VPN (max 2)
  if (answerMap.get('vpn_in_use') === 'yes') score_vpn++;
  if (answerMap.get('remote_access_satisfaction') === 'good') score_vpn++;

  // WEB (max 3)
  if (answerMap.get('critical_processes_on_website') === 'no') score_web++;
  if (answerMap.get('web_protection') && answerMap.get('web_protection') !== 'none') score_web++;
  if (answerMap.get('security_incidents') === 'no') score_web++;

  // Awareness (max 2)
  if (answerMap.get('awareness_training') === 'yes') score_awareness++;
  if (answerMap.get('infrastructure_resilience') === 'high') score_awareness++;

  const totalRaw = score_vpn + score_web + score_awareness;
  const score_total = Math.round((totalRaw / 7) * 100);

  let risk_level: RiskLevel = 'high';
  if (score_total >= 75) risk_level = 'low';
  else if (score_total >= 40) risk_level = 'medium';

  return {
    score_total,
    score_vpn,
    score_web,
    score_awareness,
    risk_level,
  };
}

export const onRequestGet: PagesFunction = async (ctx) => {
  try {
    const leadId = ctx.params.leadId as string;
    const db = ctx.env.DB as D1Database;

    const lead = await db
      .prepare(`SELECT * FROM leads WHERE id = ?`)
      .bind(leadId)
      .first();

    if (!lead) {
      return json({ ok: false, error: 'Lead not found' }, 404);
    }

    const answersRes = await db
      .prepare(`SELECT question_key, answer_value FROM lead_answers WHERE lead_id = ?`)
      .bind(leadId)
      .all();

    const answers = answersRes.results ?? [];
    const map = new Map<string, string>();
    for (const a of answers) {
      map.set(a.question_key, a.answer_value);
    }

    const scores = calcScores(map);

    return json({
      ok: true,
      item: {
        lead,
        answers,
        scores,
      },
    });
  } catch (err) {
    return json(
      { ok: false, error: 'Result fetch failed', message: String(err) },
      500
    );
  }
};
