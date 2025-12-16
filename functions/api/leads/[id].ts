export async function onRequestGet({ env, params }: any) {
  try {
    const leadId = params?.id;
    if (!leadId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing lead id' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (!env || !env.DB) {
      return new Response(JSON.stringify({ ok: false, error: 'DB binding missing' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const lead = await env.DB
      .prepare('SELECT * FROM leads WHERE id = ? LIMIT 1')
      .bind(leadId)
      .first();

    if (!lead) {
      return new Response(JSON.stringify({ ok: false, error: 'Lead not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    let answers = [];
    try {
      const r = await env.DB
        .prepare('SELECT * FROM lead_answers WHERE lead_id = ?')
        .bind(leadId)
        .all();
      answers = r?.results ?? [];
    } catch (_) {}

    let scores = null;
    try {
      scores = await env.DB
        .prepare('SELECT * FROM lead_scores WHERE lead_id = ? LIMIT 1')
        .bind(leadId)
        .first();
    } catch (_) {}

    return new Response(
      JSON.stringify({ ok: true, item: { lead, answers, scores } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Unhandled exception',
        message: String(err?.message || err),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
