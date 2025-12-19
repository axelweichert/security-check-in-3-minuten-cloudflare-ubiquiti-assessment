// functions/api/leads/export.csv.ts
type Env = { DB: D1Database };

function csvEscape(value: unknown): string {
  const s = (value ?? "").toString();
  // Excel/CSV: Quote wenn nötig + Quotes escapen
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toYesNo(v: unknown): string {
  const n = Number(v ?? 0);
  return n === 1 ? "yes" : "no";
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from");      // YYYY-MM-DD
    const to = url.searchParams.get("to");          // YYYY-MM-DD
    const status = url.searchParams.get("status");  // new|done|all
    const risk = url.searchParams.get("risk");      // low|medium|high|all
    const discount = url.searchParams.get("discount"); // yes|no|all

    const where: string[] = [];
    const params: any[] = [];

    // created_at ist ISO im Schema -> Filter über Datumsgrenzen
    if (from) {
      where.push("l.created_at >= ?");
      params.push(`${from}T00:00:00.000Z`);
    }
    if (to) {
      where.push("l.created_at <= ?");
      params.push(`${to}T23:59:59.999Z`);
    }

    if (status && status !== "all") {
      where.push("l.status = ?");
      params.push(status);
    }

    if (risk && risk !== "all") {
      where.push("s.risk_level = ?");
      params.push(risk);
    }

    if (discount && discount !== "all") {
      // im UI ist discount yes/no – DB ist 0/1
      where.push("l.discount_opt_in = ?");
      params.push(discount === "yes" ? 1 : 0);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // WICHTIG: score_total + risk_level kommen aus lead_scores (LEFT JOIN!)
    const sql = `
      SELECT
        l.id,
        l.created_at,
        l.language,
        l.company_name,
        l.contact_name,
        l.employee_range,
        l.email,
        l.phone,
        l.firewall_vendor,
        l.vpn_technology,
        l.zero_trust_vendor,
        l.consent_contact,
        l.consent_tracking,
        l.discount_opt_in,
        l.status,
        l.done_at,
        s.score_total,
        s.risk_level
      FROM leads l
      LEFT JOIN lead_scores s ON s.lead_id = l.id
      ${whereSql}
      ORDER BY l.created_at DESC
    `;

    const res = await env.DB.prepare(sql).bind(...params).all();
    const rows = ((res as any).results ?? []) as any[];

    const header = [
      "id",
      "created_at",
      "language",
      "company_name",
      "contact_name",
      "employee_range",
      "email",
      "phone",
      "firewall_vendor",
      "vpn_technology",
      "zero_trust_vendor",
      "consent_contact",
      "consent_tracking",
      "discount_opt_in",
      "status",
      "done_at",
      "score_total",
      "risk_level",
    ];

    const lines: string[] = [];
    lines.push(header.join(";"));

    for (const r of rows) {
      const line = [
        r.id,
        r.created_at,
        r.language,
        r.company_name,
        r.contact_name,
        r.employee_range,
        r.email,
        r.phone,
        r.firewall_vendor ?? "",
        r.vpn_technology ?? "",
        r.zero_trust_vendor ?? "",
        toYesNo(r.consent_contact),
        toYesNo(r.consent_tracking),
        toYesNo(r.discount_opt_in),
        r.status,
        r.done_at ?? "",
        r.score_total ?? "",
        r.risk_level ?? "",
      ].map(csvEscape);

      lines.push(line.join(";"));
    }

    const csv = lines.join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="leads-export.csv"`,
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
