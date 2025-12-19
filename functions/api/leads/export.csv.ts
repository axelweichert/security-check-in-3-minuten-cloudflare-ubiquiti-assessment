type Env = { DB: D1Database };

function csvEscape(v: unknown) {
  const s = (v ?? "").toString();
  // CSV: immer in Quotes, Quotes doppeln
  return `"${s.replace(/"/g, '""')}"`;
}

function toISODateOnly(v: string | null) {
  if (!v) return null;
  // akzeptiert ISO, SQLite DATETIME, etc.
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toISOString();
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    if (!env?.DB) {
      return new Response(JSON.stringify({ ok: false, error: "DB binding missing" }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const status = url.searchParams.get("status");
    const risk = url.searchParams.get("risk");
    const discount = url.searchParams.get("discount");

    const where: string[] = [];
    const bind: any[] = [];

    // Wir filtern wie in der Admin-Liste (best-effort ohne Schema-Annahmen)
    // created_at: existiert bei dir offenbar nicht immer -> wir filtern nur, wenn vorhanden
    // Deshalb bauen wir die WHERE für Datum NICHT hart ein.
    // Stattdessen: wir versuchen zuerst created_at, bei Fehlern fallback ohne Datum.
    const wantDateFilter = Boolean(from || to);

    if (status && status !== "all") {
      where.push(`l.status = ?`);
      bind.push(status);
    }
    if (discount && discount !== "all") {
      where.push(`l.discount_opt_in = ?`);
      bind.push(discount === "yes" ? 1 : 0);
    }
    if (risk && risk !== "all") {
      // risk_level kann in lead_scores oder leads liegen -> wir nutzen COALESCE
      where.push(`COALESCE(s.risk_level, l.risk_level) = ?`);
      bind.push(risk);
    }

    const baseSelect = `
      SELECT
        l.id,
        l.company_name,
        l.contact_name,
        l.email,
        l.phone,
        l.employee_range,
        l.firewall_vendor,
        l.vpn_technology,
        l.zero_trust_vendor,
        l.consent_contact,
        l.consent_tracking,
        l.discount_opt_in,
        l.status,
        COALESCE(s.score_total, l.score_total) AS score_total,
        COALESCE(s.risk_level, l.risk_level) AS risk_level,
        l.created_at
      FROM leads l
      LEFT JOIN lead_scores s ON s.lead_id = l.id
    `;

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderSql = `ORDER BY l.rowid DESC`;

    // 1) Versuch: mit created_at + optionalem Datumsfilter
    const tryWithCreatedAt = async () => {
      const where2 = [...where];
      const bind2 = [...bind];

      if (wantDateFilter) {
        if (from) {
          where2.push(`l.created_at >= ?`);
          bind2.push(from);
        }
        if (to) {
          where2.push(`l.created_at <= ?`);
          bind2.push(to);
        }
      }

      const whereSql2 = where2.length ? `WHERE ${where2.join(" AND ")}` : "";
      const sql = `${baseSelect} ${whereSql2} ${orderSql}`;
      return env.DB.prepare(sql).bind(...bind2).all();
    };

    // 2) Fallback: ohne created_at (falls Spalte nicht existiert)
    const tryWithoutCreatedAt = async () => {
      // identisch, aber ohne l.created_at im SELECT und ohne Datumfilter
      const sql = `
        SELECT
          l.id,
          l.company_name,
          l.contact_name,
          l.email,
          l.phone,
          l.employee_range,
          l.firewall_vendor,
          l.vpn_technology,
          l.zero_trust_vendor,
          l.consent_contact,
          l.consent_tracking,
          l.discount_opt_in,
          l.status,
          COALESCE(s.score_total, l.score_total) AS score_total,
          COALESCE(s.risk_level, l.risk_level) AS risk_level
        FROM leads l
        LEFT JOIN lead_scores s ON s.lead_id = l.id
        ${whereSql}
        ${orderSql}
      `;
      return env.DB.prepare(sql).bind(...bind).all();
    };

    let rows: any[] = [];
    let hasCreatedAt = true;

    try {
      const r = await tryWithCreatedAt();
      rows = (r?.results ?? []) as any[];
      hasCreatedAt = true;
    } catch (e: any) {
      // typischer Fall bei dir: "no such column: created_at"
      const r = await tryWithoutCreatedAt();
      rows = (r?.results ?? []) as any[];
      hasCreatedAt = false;
    }

    const headers = [
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
      "status",
      "score_total",
      "risk_level",
      ...(hasCreatedAt ? ["created_at"] : []),
    ];

    const lines: string[] = [];
    lines.push(headers.map(csvEscape).join(","));

    for (const r of rows) {
      const createdAt = hasCreatedAt ? toISODateOnly(r.created_at) : undefined;
      const vals = [
        r.id,
        r.company_name,
        r.contact_name,
        r.email,
        r.phone,
        r.employee_range,
        r.firewall_vendor,
        r.vpn_technology,
        r.zero_trust_vendor,
        r.consent_contact ? "1" : "0",
        r.consent_tracking ? "1" : "0",
        r.discount_opt_in ? "1" : "0",
        r.status,
        r.score_total ?? "",
        r.risk_level ?? "",
        ...(hasCreatedAt ? [createdAt ?? ""] : []),
      ];
      lines.push(vals.map(csvEscape).join(","));
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
    return new Response(
      JSON.stringify({ ok: false, error: "Export failed", message: String(e?.message ?? e) }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
};

