export const onRequestGet: PagesFunction = async ({ env, params }) => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });

  try {
    const id = String((params as any)?.id ?? "").trim();
    if (!id) return json(400, { ok: false, error: "Missing lead id" });

    const db = (env as any).DB;
    if (!db) return json(500, { ok: false, error: "D1 binding DB missing on env" });

    // 1) Lead
    const lead = await db
      .prepare("SELECT * FROM leads WHERE id = ? LIMIT 1")
      .bind(id)
      .first();

    if (!lead) return json(404, { ok: false, error: "Lead not found" });

    // 2) Optional: Answers (falls Tabelle existiert)
    let answers: any[] = [];
    try {
      const a = await db
        .prepare("SELECT question, answer FROM lead_answers WHERE lead_id = ? ORDER BY question")
        .bind(id)
        .all();
      answers = a?.results ?? [];
    } catch {
      answers = [];
    }

    // 3) Optional: Scores (falls Tabelle existiert)
    let scores: any = null;
    try {
      scores = await db
        .prepare("SELECT * FROM lead_scores WHERE lead_id = ? LIMIT 1")
        .bind(id)
        .first();
    } catch {
      scores = null;
    }

    return json(200, { ok: true, item: { lead, answers, scores } });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "Lead detail failed",
      message: e?.message ?? String(e),
    });
  }
};
