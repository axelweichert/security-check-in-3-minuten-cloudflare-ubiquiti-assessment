import { computeScores } from '../../../shared/scoring';

type Env = {
  DB: D1Database;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const id = ctx.params.id as string | undefined;
  if (!id) return json(400, { ok: false, error: 'Missing lead id' });

  // Lead
  const lead = await ctx.env.DB.prepare(
    `SELECT
      id, created_at, language, company_name, contact_name, employee_range,
      email, phone, firewall_vendor, vpn_technology, zero_trust_vendor,
      consent_contact, consent_tracking, discount_opt_in,
      status, done_at
     FROM leads
     WHERE id = ?`
  ).bind(id).first<any>();

  if (!lead) return json(404, { ok: false, error: 'Lead not found' });

  // Answers
  const answersRes = await ctx.env.DB.prepare(
    `SELECT id, lead_id, question_key, answer_value, created_at
     FROM lead_answers
     WHERE lead_id = ?
     ORDER BY created_at ASC`
  ).bind(id).all<any>();

  const answers = answersRes.results ?? [];

  // Scores (serverseitig, nie null)
  const scores = computeScores({
    lead: {
      employee_range: lead.employee_range,
      firewall_vendor: lead.firewall_vendor,
      vpn_technology: lead.vpn_technology,
      zero_trust_vendor: lead.zero_trust_vendor,
    },
    answers: answers.map((a: any) => ({ question_key: a.question_key, answer_value: a.answer_value })),
  });

  return json(200, {
    ok: true,
    item: {
      lead,
      answers,
      scores,
    },
  });
};
