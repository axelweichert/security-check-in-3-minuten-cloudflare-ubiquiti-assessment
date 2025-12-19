type Env = { DB: D1Database };

type LeadRow = {
  id: string;
  company_name: string | null;
  created_at: string | null;
  status: string | null;
  risk_level: string | null;
  discount_opt_in: number | null;
};

const text = (status: number, body: string, headers: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...headers,
    },
  });

async function tableHasColumn(env: Env, table: string, column: string) {
  const r = await env.DB.prepare(`PRAGMA table_info(${table});`).all();
  const rows = (r as any).results as Array<{ name: string }>;
  return rows?.some((x) => x.name === column) ?? false;
}

function normalizeRisk(v: unknown): "low" | "medium" | "high" {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "low" || s === "medium" || s === "high") return s as any;
  // defensiv: wenn irgendwas Unerwartetes kommt, nicht crashen
  return "medium";
}

function riskLabelDe(risk: string) {
  if (risk === "low") return "Niedrig";
  if (risk === "high") return "Hoch";
  return "Mittel";
}

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  // RFC4180: wenn Komma, Quote oder Zeilenumbruch: doppelte Quotes, umschließen mit Quotes
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    if (!env.DB) return text(500, JSON.stringify({ ok: false, error: "DB binding missing (expected env.DB)" }));

    // Timestamp-Spalte robust ermitteln (weil ihr Schema hier schon mal abwich)
    const hasCreatedAt = await tableHasColumn(env as any, "leads", "created_at");
    const hasCreatedAtCamel = await tableHasColumn(env as any, "leads", "createdAt");
    const hasCreated = await tableHasColumn(env as any, "leads", "created");
    const hasSubmittedAt = await tableHasColumn(env as any, "leads", "submitted_at");

    const createdCol =
      hasCreatedAt ? "l.created_at" :
      hasCreatedAtCamel ? "l.createdAt" :
      hasSubmittedAt ? "l.submitted_at" :
      hasCreated ? "l.created" :
      // letzter Fallback: leere Spalte, aber kein Crash
      "NULL";

    const hasStatus = await tableHasColumn(env as any, "leads", "status");
    const hasDiscount = await tableHasColumn(env as any, "leads", "discount_opt_in");

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitRaw ?? 5000), 1), 20000);

    // risk_level kommt (wenn vorhanden) aus lead_scores.rating, sonst fallback
    let rows: LeadRow[] = [];
    try {
      const sql = `
        SELECT
          l.id AS id,
          l.company_name AS company_name,
          ${createdCol} AS created_at,
          ${hasStatus ? "COALESCE(l.status,'new')" : "'new'"} AS status,
          COALESCE(s.rating, 'medium') AS risk_level,
          ${hasDiscount ? "COALESCE(l.discount_opt_in,0)" : "0"} AS discount_opt_in
        FROM leads l
        LEFT JOIN lead_scores s ON s.lead_id = l.id
        ORDER BY ${createdCol !== "NULL" ? createdCol : "l.rowid"} DESC
        LIMIT ?;
      `;
      const r = await env.DB.prepare(sql).bind(limit).all();
      rows = ((r as any).results ?? []) as LeadRow[];
    } catch {
      const sql = `
        SELECT
          id,
          company_name,
          ${createdCol.replace("l.", "")} AS created_at,
          ${hasStatus ? "COALESCE(status,'new')" : "'new'"} AS status,
          'medium' AS risk_level,
          ${hasDiscount ? "COALESCE(discount_opt_in,0)" : "0"} AS discount_opt_in
        FROM leads
        ORDER BY ${createdCol !== "NULL" ? createdCol.replace("l.", "") : "rowid"} DESC
        LIMIT ?;
      `;
      const r = await env.DB.prepare(sql).bind(limit).all();
      rows = ((r as any).results ?? []) as LeadRow[];
    }

    const header = [
      "id",
      "company_name",
      "created_at",
      "status",
      "risk_level",
      "risk_label_de",
      "discount_opt_in",
    ].join(",");

    const lines = rows.map((x) => {
      const risk = normalizeRisk(x.risk_level);
      return [
        csvEscape(x.id),
        csvEscape(x.company_name ?? ""),
        csvEscape(x.created_at ?? ""),
        csvEscape(x.status ?? "new"),
        csvEscape(risk),
        csvEscape(riskLabelDe(risk)),
        csvEscape(Number(x.discount_opt_in ?? 0) ? 1 : 0),
      ].join(",");
    });

    const csv = [header, ...lines].join("\r\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="leads-export.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("export.csv error:", err);
    return text(
      500,
      JSON.stringify({
        ok: false,
        error: "Export failed",
        message: String(err?.message ?? err),
        name: err?.name,
      }),
      { "content-type": "application/json; charset=utf-8" }
    );
  }
};
