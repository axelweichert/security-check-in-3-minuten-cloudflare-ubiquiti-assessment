// Cloudflare Pages Function: /api/leads/export.csv
// Computes score_total / sub-scores from stored answers to avoid relying on
// non-existent DB columns such as `score_total`.

type Env = { DB: D1Database };

type LeadRow = Record<string, any>;

type AnswerRow = {
  lead_id: string;
  question_key: string;
  answer_value: any;
};

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

  // --- TOTAL (0..100)
  const score_total = clamp(Math.round(((score_vpn + score_web + score_awareness) / 7) * 100), 0, 100);
  const risk_level = normalizeRiskFromPercent(score_total);

  return { score_total, score_vpn, score_web, score_awareness, risk_level };
}

function parseBoolLike(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function csvEscape(v: any): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function getColumns(env: Env, table: string): Promise<Set<string>> {
  const res = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const cols = new Set<string>();
  for (const r of (res as any).results ?? []) cols.add(String(r.name));
  return cols;
}

function pickFirstExisting(cols: Set<string>, candidates: string[]): string | null {
  for (const c of candidates) if (cols.has(c)) return c;
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);

    // filters (same semantics as admin list)
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const to = url.searchParams.get("to"); // YYYY-MM-DD
    const status = url.searchParams.get("status"); // new|done
    const risk = url.searchParams.get("risk"); // low|medium|high
    const discount = url.searchParams.get("discount"); // yes|no

    const leadCols = await getColumns(env, "leads");
    const createdCol = pickFirstExisting(leadCols, ["created_at", "createdAt", "created"]);

    const where: string[] = [];
    const binds: any[] = [];

    if (from && createdCol) {
      where.push(`${createdCol} >= ?`);
      binds.push(`${from} 00:00:00`);
    }
    if (to && createdCol) {
      where.push(`${createdCol} <= ?`);
      binds.push(`${to} 23:59:59`);
    }
    if (status && status !== "all") {
      where.push(`status = ?`);
      binds.push(status);
    }
    if (risk && risk !== "all") {
      // risk_level is expected to exist (admin uses it), but we don't hard-fail if not.
      if (leadCols.has("risk_level")) {
        where.push(`risk_level = ?`);
        binds.push(risk);
      }
    }
    if (discount && discount !== "all") {
      const want = discount === "yes";
      where.push(`discount_opt_in = ?`);
      binds.push(want ? 1 : 0);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Select only known-safe columns; missing ones become empty in CSV rows.
    const selectCols = [
      "id",
      createdCol || "created_at",
      "company_name",
      "contact_name",
      "email",
      "phone",
      "employee_range",
      "firewall_vendor",
      "vpn_technology",
      "zero_trust_vendor",
      "status",
      "discount_opt_in",
      "risk_level",
    ]
      .filter(Boolean)
      .map((c) => String(c));

    // De-duplicate column names (e.g. if createdCol is already created_at)
    const seen = new Set<string>();
    const finalSelectCols: string[] = [];
    for (const c of selectCols) {
      if (!seen.has(c)) {
        seen.add(c);
        // Only include cols that exist (except createdCol fallback string)
        if (leadCols.has(c)) finalSelectCols.push(c);
      }
    }
    // Ensure we always have id at least
    if (!finalSelectCols.includes("id")) finalSelectCols.unshift("id");

    const sql = `SELECT ${finalSelectCols.join(", ")} FROM leads ${whereSql} ORDER BY rowid DESC LIMIT 5000`;
    const leadRes = await env.DB.prepare(sql).bind(...binds).all();
    const leads: LeadRow[] = ((leadRes as any).results ?? []) as LeadRow[];

    // Load answers for those leads in chunks (avoid huge IN lists).
    const ids = leads.map((l) => String(l.id ?? "")).filter(Boolean);
    const answersByLead = new Map<string, AnswerRow[]>();

    if (ids.length) {
      for (const group of chunk(ids, 200)) {
        const placeholders = group.map(() => "?").join(", ");
        const aSql = `SELECT lead_id, question_key, answer_value FROM lead_answers WHERE lead_id IN (${placeholders})`;
        const aRes = await env.DB.prepare(aSql).bind(...group).all();
        const rows: AnswerRow[] = ((aRes as any).results ?? []) as any[];

        for (const r of rows) {
          const lid = String((r as any).lead_id ?? "");
          if (!lid) continue;
          const arr = answersByLead.get(lid) ?? [];
          arr.push({
            lead_id: lid,
            question_key: String((r as any).question_key ?? ""),
            answer_value: (r as any).answer_value,
          });
          answersByLead.set(lid, arr);
        }
      }
    }

    // CSV output columns (stable header)
    const header = [
      "id",
      "created_at",
      "company_name",
      "contact_name",
      "email",
      "phone",
      "employee_range",
      "firewall_vendor",
      "vpn_technology",
      "zero_trust_vendor",
      "status",
      "discount_opt_in",
      "risk_level",
      "score_total",
      "score_vpn",
      "score_web",
      "score_awareness",
    ];

    const lines: string[] = [];
    lines.push(header.map(csvEscape).join(","));

    for (const lead of leads) {
      const id = String(lead.id ?? "");
      const created = createdCol ? String(lead[createdCol] ?? "") : "";

      const answers = answersByLead.get(id) ?? [];
      const scores = computeScoresFromAnswers(
        answers.map((a) => ({ question_key: a.question_key, answer_value: a.answer_value })),
      );

      const row = {
        id,
        created_at: created,
        company_name: String(lead.company_name ?? ""),
        contact_name: String(lead.contact_name ?? ""),
        email: String(lead.email ?? ""),
        phone: String(lead.phone ?? ""),
        employee_range: String(lead.employee_range ?? ""),
        firewall_vendor: String(lead.firewall_vendor ?? ""),
        vpn_technology: String(lead.vpn_technology ?? ""),
        zero_trust_vendor: String(lead.zero_trust_vendor ?? ""),
        status: String(lead.status ?? ""),
        discount_opt_in: parseBoolLike(lead.discount_opt_in) ? "1" : "0",
        risk_level: String(lead.risk_level ?? scores.risk_level ?? ""),
        score_total: String(scores.score_total),
        score_vpn: String(scores.score_vpn),
        score_web: String(scores.score_web),
        score_awareness: String(scores.score_awareness),
      };

      lines.push(header.map((k) => csvEscape((row as any)[k])).join(","));
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
    const msg = e?.message ? String(e.message) : String(e);
    const stack = e?.stack ? String(e.stack) : "";
    return new Response(JSON.stringify({ ok: false, error: "CSV export failed", message: msg, stack }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
