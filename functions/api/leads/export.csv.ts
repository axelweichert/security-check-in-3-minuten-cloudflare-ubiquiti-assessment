type Env = { DB: D1Database };

type LeadRow = Record<string, any>;

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
  else if (protection) web += 1.0;

  if (critical === "yes" && protection === "none") web -= 0.8;
  if (incidents === "yes") web -= 0.7;

  const score_web = clamp(Math.round(web * 100) / 100, 0, 3);

  // --- AWARENESS (0..2)
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
  else if (dmg) aw += 0.0;

  const score_awareness = clamp(Math.round(aw * 100) / 100, 0, 2);

  // total (0..100)
  const score_total = clamp(Math.round(((score_vpn + score_web + score_awareness) / 7) * 100), 0, 100);
  const risk_level = normalizeRiskFromPercent(score_total);

  return { score_total, score_vpn, score_web, score_awareness, risk_level };
}

async function tableHasColumn(env: Env, table: string, column: string): Promise<boolean> {
  const r = await env.DB.prepare(`PRAGMA table_info(${table});`).all();
  const cols = ((r as any).results ?? []) as Array<{ name: string }>;
  return cols.some((c) => c?.name === column);
}

function csvEscape(v: unknown): string {
  const s = (v ?? "").toString();
  const needs = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const url = new URL(request.url);

    // optional filters (same keys wie AdminPage)
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const status = url.searchParams.get("status") || "";
    const risk = url.searchParams.get("risk") || "";
    const discount = url.searchParams.get("discount") || "";

    const hasCreatedAt = await tableHasColumn(env, "leads", "created_at");
    const hasCreatedAtAlt = !hasCreatedAt && (await tableHasColumn(env, "leads", "createdAt"));
    const createdCol = hasCreatedAt ? "created_at" : hasCreatedAtAlt ? "createdAt" : "";

    const hasStatus = await tableHasColumn(env, "leads", "status");
    const hasDiscount = await tableHasColumn(env, "leads", "discount_opt_in");

    // Wir selektieren defensiv nur vorhandene Felder, plus immer id/company_name
    const selectCols: string[] = [
      "id",
      "company_name",
      "contact_name",
      "email",
      "phone",
      "employee_range",
      "firewall_vendor",
      "vpn_technology",
      "zero_trust_vendor",
      "consent_contact",
      "consent_tracking",
      "discount_opt_in",
    ];

    const available: string[] = [];
    for (const c of selectCols) {
      if (c === "discount_opt_in") {
        if (hasDiscount) available.push("discount_opt_in");
        continue;
      }
      if (await tableHasColumn(env, "leads", c)) available.push(c);
    }
    if (createdCol) available.push(createdCol);
    if (hasStatus) available.push("status");

    // Base query
    const where: string[] = [];
    const binds: any[] = [];

    if (createdCol && from) {
      where.push(`${createdCol} >= ?`);
      binds.push(from);
    }
    if (createdCol && to) {
      // inclusive "to" -> wir machen < (to + 1 Tag) nur wenn Datum (YYYY-MM-DD) kommt
      // Wenn bei euch created_at ISO ist, ist das trotzdem ok für den üblichen Admin-Use.
      where.push(`${createdCol} <= ?`);
      binds.push(to);
    }
    if (hasStatus && status && status !== "all") {
      where.push(`status = ?`);
      binds.push(status);
    }
    if (hasDiscount && discount && discount !== "all") {
      where.push(`discount_opt_in = ?`);
      binds.push(discount === "yes" ? 1 : 0);
    }

    const sql = `
      SELECT ${available.length ? available.join(", ") : "id, company_name"}
      FROM leads
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ${createdCol ? `ORDER BY ${createdCol} DESC` : "ORDER BY id DESC"}
      LIMIT 5000;
    `;

    const r = await env.DB.prepare(sql).bind(...binds).all();
    const leads = (((r as any).results ?? []) as LeadRow[]).map((x) => x ?? {});

    // Header
    const header = [
      "id",
      "company_name",
      "created_at",
      "status",
      "risk_level",
      "score_total",
      "score_vpn",
      "score_web",
      "score_awareness",
      "discount_opt_in",
      "contact_name",
      "email",
      "phone",
      "employee_range",
      "firewall_vendor",
      "vpn_technology",
      "zero_trust_vendor",
      "consent_contact",
      "consent_tracking",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    // pro Lead: Antworten lesen -> Scores berechnen -> optional risk-Filter anwenden
    for (const lead of leads) {
      const leadId = String(lead.id ?? "");
      if (!leadId) continue;

      const ans = await env.DB
        .prepare(`SELECT question_key, answer_value FROM lead_answers WHERE lead_id = ? ORDER BY rowid ASC`)
        .bind(leadId)
        .all();

      const items = (((ans as any).results ?? []) as any[]).map((a) => ({
        question_key: a.question_key,
        answer_value: a.answer_value,
      }));

      const scores = computeScoresFromAnswers(items);

      if (risk && risk !== "all" && scores.risk_level !== risk) continue;

      const createdVal =
        createdCol && lead[createdCol] != null ? lead[createdCol] : "";

      const row = [
        leadId,
        lead.company_name ?? "",
        createdVal,
        hasStatus ? (lead.status ?? "new") : "new",
        scores.risk_level,
        scores.score_total,
        scores.score_vpn,
        scores.score_web,
        scores.score_awareness,
        hasDiscount ? (lead.discount_opt_in ?? 0) : 0,
        lead.contact_name ?? "",
        lead.email ?? "",
        lead.phone ?? "",
        lead.employee_range ?? "",
        lead.firewall_vendor ?? "",
        lead.vpn_technology ?? "",
        lead.zero_trust_vendor ?? "",
        lead.consent_contact ?? "",
        lead.consent_tracking ?? "",
      ].map(csvEscape);

      lines.push(row.join(","));
    }

    const csv = lines.join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="leads_export_${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("CSV export failed:", e);
    const msg = e?.message ? String(e.message) : String(e);
    const stack = e?.stack ? String(e.stack) : "";
    return new Response(JSON.stringify({ ok: false, error: "CSV export failed", message: msg, stack }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};