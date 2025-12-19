type Env = { DB: D1Database };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function normalizeRiskFromPercent(pct: number) {
  return pct >= 75 ? 'low' : pct >= 40 ? 'medium' : 'high';
}

/**
 * Score-Logik (identisch zur PDF-Logik, soweit möglich).
 */
function computeScoresFromAnswers(items: { question_key: string; answer_value: any }[]) {
  const m = new Map<string, string>();
  for (const a of items) m.set(String(a.question_key ?? ''), String(a.answer_value ?? ''));
  const get = (k: string) => (m.get(k) ?? '').toString();

  let vpn = 0;
  const vpnInUse = get('vpn_in_use');
  if (vpnInUse === 'yes') vpn += 0.5;

  const vpnTech = get('vpn_technology');
  if (vpnTech === 'wireguard' || vpnTech === 'ipsec') vpn += 0.75;
  else if (vpnTech === 'sslvpn') vpn += 0.35;
  else if (vpnTech === 'pptp') vpn += 0.0;

  const vpnSol = get('vpn_solution');
  if (vpnSol === 'zero_trust' || vpnSol === 'ztna') vpn += 0.75;
  else if (vpnSol === 'firewall_vpn' || vpnSol === 'vpn_gateway') vpn += 0.45;

  const sat = get('remote_access_satisfaction');
  if (sat === 'satisfied') vpn += 0.25;
  else if (sat === 'neutral') vpn += 0.1;
  else if (sat === 'unsatisfied') vpn += 0.0;

  const users = get('vpn_users');
  if (users === 'less_than_10') vpn += 0.15;
  else if (users === '10_49') vpn += 0.1;
  else if (users) vpn += 0.05;

  const score_vpn = clamp(Math.round(vpn * 100) / 100, 0, 2);

  let web = 0;
  const critical = get('critical_processes_on_website');
  const hosting = get('hosting_type');
  const protection = get('web_protection');
  const incidents = get('security_incidents');

  if (hosting === 'managed_hosting') web += 0.5;
  else if (hosting === 'cloud' || hosting === 'saas') web += 0.7;
  else if (hosting) web += 0.25;

  if (protection === 'none') web += 0.0;
  else if (protection === 'basic') web += 0.75;
  else if (protection === 'waf') web += 1.6;
  else if (protection === 'waf_ddos' || protection === 'waf+ddos') web += 2.2;
  else if (protection) web += 1.0;

  if (critical === 'yes' && protection === 'none') web -= 0.8;
  if (incidents === 'yes') web -= 0.7;

  const score_web = clamp(Math.round(web * 100) / 100, 0, 3);

  let aw = 0;
  const training = get('awareness_training');
  const resil = get('infrastructure_resilience');
  const dmg = get('financial_damage_risk');

  if (training === 'yes') aw += 0.9;
  else if (training === 'partially') aw += 0.45;

  if (resil === 'high') aw += 0.7;
  else if (resil === 'medium') aw += 0.35;

  if (dmg === 'less_than_5k') aw += 0.4;
  else if (dmg === '5k_to_25k') aw += 0.2;
  else if (dmg) aw += 0.0;

  const score_awareness = clamp(Math.round(aw * 100) / 100, 0, 2);

  const score_total = clamp(Math.round(((score_vpn + score_web + score_awareness) / 7) * 100), 0, 100);
  const risk_level = normalizeRiskFromPercent(score_total);

  return { score_total, score_vpn, score_web, score_awareness, risk_level };
}

async function getTableColumns(env: Env, tableName: string): Promise<Set<string>> {
  const res = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
  const cols = new Set<string>();
  for (const row of ((res as any).results ?? []) as any[]) cols.add(String(row.name));
  return cols;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  try {
    const leadId = (params as any)?.id as string | undefined;
    if (!leadId) return json({ ok: false, error: 'Missing id' }, 400);

    const leadCols = await getTableColumns(env, 'leads');

    const baseCols = [
      'id',
      'company_name',
      'created_at',
      'status',
      'risk_level',
      'discount_opt_in',
      'language',
      'contact_name',
      'email',
      'phone',
      'employee_range',
      'firewall_vendor',
      'vpn_technology',
      'zero_trust_vendor',
      'consent_contact',
      'consent_tracking',
    ].filter((c) => leadCols.has(c));

    const selectCols = baseCols.length ? baseCols.join(', ') : '*';

    const leadRes = await env.DB.prepare(`SELECT ${selectCols} FROM leads WHERE id = ? LIMIT 1`).bind(leadId).all();
    const lead = ((leadRes as any).results?.[0] ?? null) as any;
    if (!lead) return json({ ok: false, error: 'Not found' }, 404);

    // WICHTIG: lead_answers hat bei dir sehr wahrscheinlich KEIN created_at -> deshalb NICHT selektieren.
    const ansRes = await env.DB
      .prepare('SELECT id, question_key, answer_value FROM lead_answers WHERE lead_id = ? ORDER BY rowid ASC')
      .bind(leadId)
      .all();

    const answers = (((ansRes as any).results ?? []) as any[]).map((a: any) => ({
      id: a.id,
      question_key: a.question_key,
      answer_value: a.answer_value,
    }));

    const scores = computeScoresFromAnswers(answers);

    // Konsistenz: Detail zeigt denselben risk_level wie berechnet.
    lead.risk_level = scores.risk_level;

    return json({ ok: true, lead, answers, scores });
  } catch (e: any) {
    return json(
      { ok: false, error: 'Failed to load lead', message: String(e?.message ?? e), stack: String(e?.stack ?? '') },
      500
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ params, env, request }) => {
  try {
    const leadId = (params as any)?.id as string | undefined;
    if (!leadId) return json({ ok: false, error: 'Missing id' }, 400);

    const body: any = await request.json().catch(() => ({}));
    const status = (body?.status ?? '').toString();

    if (status !== 'new' && status !== 'done') {
      return json({ ok: false, error: 'Invalid status' }, 400);
    }

    const leadCols = await getTableColumns(env, 'leads');
    if (!leadCols.has('status')) {
      return json({ ok: false, error: 'DB schema missing status column' }, 500);
    }

    await env.DB.prepare('UPDATE leads SET status = ? WHERE id = ?').bind(status, leadId).run();
    return json({ ok: true, id: leadId, status });
  } catch (e: any) {
    return json(
      { ok: false, error: 'Failed to update status', message: String(e?.message ?? e), stack: String(e?.stack ?? '') },
      500
    );
  }
};
