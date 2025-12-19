type Env = { DB: D1Database };

function csvEscape(v: unknown): string {
  const s = (v ?? "").toString();
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toBool01(v: unknown): "0" | "1" {
  if (v === 1 || v === "1" || v === true) return "1";
  return "0";
}

function mapRiskDe(risk: unknown): string {
  const r = (risk ?? "").toString().toLowerCase();
  if (r === "low") return "Niedrig";
  if (r === "medium") return "Mittel";
  if (r === "high") return "Hoch";
  return (risk ?? "").toString();
}

function normalizeYesNo(v: unknown): string {
  const s = (v ?? "").toString().toLowerCase();
  if (s === "yes" || s === "1" || s === "true") return "Ja";
  if (s === "no" || s === "0" || s === "false") return "Nein";
  return (v ?? "").toString();
}

async function getLeadCreatedColumn(env: Env): Promise<string> {
  // Robust gegen unterschiedliche Schemas in Prod/Dev
  const infoRes = await env.DB.prepare(`PRAGMA table_info(leads)`).all();
  const cols = new Set<string>(
    ((infoRes as any).results ?? []).map((r: any) => String(r.name ?? "").toLowerCase())
  );

  if (cols.has("created_at")) return "created_at";
  if (cols.has("createdat")) return "createdAt";
  if (cols.has("created")) return "created";
  // Fallback (kommt als ISO-string raus) – besser als komplett zu scheitern
  return "rowid";
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);

    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const status = (url.searchParams.get("status") || "").toLowerCase(); // new|done
    const risk = (url.searchParams.get("risk") || "").toLowerCase(); // low|medium|high
    const discount = (url.searchParams.get("discount") || "").toLowerCase(); // yes|no

    const createdCol = await getLeadCreatedColumn(env);

    const where: string[] = [];
    const binds: any[] = [];

    if (from) {
      where.push(`${createdCol} >= ?`);
      binds.push(from);
    }
    if (to) {
      // to ist date input (YYYY-MM-DD). Wir nehmen inclusive bis 23:59:59, wenn createdCol datetime enthält.
      // Wenn createdCol nur Date enthält, ist das ebenfalls ok.
      where.push(`${createdCol} <= ?`);
      binds.push(to.length === 10 ? `${to}T23:59:59.999Z` : to);
    }
    if (status && status !== "all") {
      where.push(`status = ?`);
      binds.push(status);
    }
    if (risk && risk !== "all") {
      where.push(`risk_level = ?`);
      binds.push(risk);
    }
    if (discount && discount !== "all") {
      where.push(`discount_opt_in = ?`);
      binds.push(discount === "yes" ? 1 : 0);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Spalten bewusst explizit (stabiler Export)
    const sql = `
      SELECT
        id,
        ${createdCol} as created_at,
        language,
        company_name,
        contact_name,
        employee_range,
        email,
        phone,
        firewall_vendor,
        vpn_technology,
        zero_trust_vendor,
        consent_contact,
        consent_tracking,
        discount_opt_in,
        status,
        score_total,
        risk_level
      FROM leads
      ${whereSql}
      ORDER BY ${createdCol} DESC
      LIMIT 5000
    `.trim();

    let stmt = env.DB.prepare(sql);
    if (binds.length) stmt = stmt.bind(...binds);
    const res = await stmt.all();

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
      "score_total",
      "risk_level",
      "risk_de",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rows) {
      const riskLevel = (r.risk_level ?? "").toString();
      const line = [
        csvEscape(r.id),
        csvEscape(r.created_at),
        csvEscape(r.language),
        csvEscape(r.company_name),
        csvEscape(r.contact_name),
        csvEscape(r.employee_range),
        csvEscape(r.email),
        csvEscape(r.phone),
        csvEscape(r.firewall_vendor),
        csvEscape(r.vpn_technology),
        csvEscape(r.zero_trust_vendor),
        csvEscape(normalizeYesNo(toBool01(r.consent_contact))),
        csvEscape(normalizeYesNo(toBool01(r.consent_tracking))),
        csvEscape(normalizeYesNo(toBool01(r.discount_opt_in))),
        csvEscape(r.status),
        csvEscape(r.score_total),
        csvEscape(riskLevel),
        csvEscape(mapRiskDe(riskLevel)),
      ];
      lines.push(line.join(","));
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
    const msg = e?.message ? String(e.message) : String(e);
    const stack = e?.stack ? String(e.stack) : "";
    return new Response(JSON.stringify({ ok: false, error: "CSV export failed", message: msg, stack }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};

