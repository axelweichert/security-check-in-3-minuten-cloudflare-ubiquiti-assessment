type Env = { DB: D1Database };

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  try {
    // Count before delete (best-effort)
    const leadsCountRes = await env.DB.prepare('SELECT COUNT(*) AS n FROM leads').all();
    const answersCountRes = await env.DB.prepare('SELECT COUNT(*) AS n FROM lead_answers').all();

    const leadsCount = Number((leadsCountRes as any).results?.[0]?.n ?? 0);
    const answersCount = Number((answersCountRes as any).results?.[0]?.n ?? 0);

    // Delete answers first (FK safety), then leads
    await env.DB.batch([
      env.DB.prepare('DELETE FROM lead_answers'),
      env.DB.prepare('DELETE FROM leads'),
    ]);

    return json({ ok: true, deleted: { leads: leadsCount, answers: answersCount } });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    const stack = e?.stack ? String(e.stack) : '';
    return json({ ok: false, error: 'Purge failed', message: msg, stack }, 500);
  }
};
