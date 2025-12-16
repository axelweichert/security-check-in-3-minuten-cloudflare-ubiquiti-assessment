type LeadItem = {
  id: string;
  company_name: string;
  created_at: string;
  status: string;
  risk_level: string;
  discount_opt_in: number;
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

async function tableHasColumn(env: Env, table: string, column: string) {
  const r = await env.DB.prepare(`PRAGMA table_info(${table});`).all();
  const rows = (r as any).results as Array<{ name: string }>;
  return rows?.some((x) => x.name === column) ?? false;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    if (!env.DB) return json(500, { ok: false, error: "DB binding missing (expected env.DB)" });

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitRaw ?? 200), 1), 500);

    // Determine optional columns safely
    const hasStatus = await tableHasColumn(env, "leads", "status");
    const hasDiscount = await tableHasColumn(env, "leads", "discount_opt_in");

    // Try to enrich with lead_scores.rating as risk_level (if table exists)
    let items: LeadItem[] = [];

    try {
      // If lead_scores doesn't exist, this will throw and we fall back.
      const sql = `
        SELECT
          l.id AS id,
          l.company_name AS company_name,
          l.created_at AS created_at,
          ${hasStatus ? "COALESCE(l.status,'new')" : "'new'"} AS status,
          COALESCE(s.rating, 'medium') AS risk_level,
          ${hasDiscount ? "COALESCE(l.discount_opt_in,0)" : "0"} AS discount_opt_in
        FROM leads l
        LEFT JOIN lead_scores s ON s.lead_id = l.id
        ORDER BY l.created_at DESC
        LIMIT ?;
      `;
      const r = await env.DB.prepare(sql).bind(limit).all();
      items = ((r as any).results ?? []) as LeadItem[];
    } catch {
      // Fallback: no join, no assumptions beyond minimal fields
      const sql = `
        SELECT
          id,
          company_name,
          created_at,
          ${hasStatus ? "COALESCE(status,'new')" : "'new'"} AS status,
          'medium' AS risk_level,
          ${hasDiscount ? "COALESCE(discount_opt_in,0)" : "0"} AS discount_opt_in
        FROM leads
        ORDER BY created_at DESC
        LIMIT ?;
      `;
      const r = await env.DB.prepare(sql).bind(limit).all();
      items = ((r as any).results ?? []) as LeadItem[];
    }

    return json(200, { ok: true, items });
  } catch (err: any) {
    console.error("leads error:", err);
    return json(500, {
      ok: false,
      error: "Load leads failed",
      message: String(err?.message ?? err),
      name: err?.name,
    });
  }
};
