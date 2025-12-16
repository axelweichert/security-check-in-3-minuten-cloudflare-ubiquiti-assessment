export async function onRequestGet(context: any) {
  try {
    const { env, params } = context;
    const id = params.id as string;

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ ok: false, error: "Missing D1 binding env.DB" }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const lead = await db.prepare(
      `SELECT *
       FROM leads
       WHERE id = ?`
    ).bind(id).first();

    if (!lead) {
      return new Response(JSON.stringify({ ok: false, error: "Lead not found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const answers = await db.prepare(
      `SELECT question_key, answer
       FROM lead_answers
       WHERE lead_id = ?
       ORDER BY question_key`
    ).bind(id).all();

    const score = await db.prepare(
      `SELECT *
       FROM lead_scores
       WHERE lead_id = ?`
    ).bind(id).first();

    return new Response(
      JSON.stringify({
        ok: true,
        item: {
          lead,
          answers: answers?.results ?? [],
          score: score ?? null,
        },
      }),
      { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: "Failed loading lead detail", message: e?.message || String(e) }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
