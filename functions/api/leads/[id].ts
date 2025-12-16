import { json } from '../../_utils/json';
import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequestGet: PagesFunction = async ({ env, params }) => {
  try {
    const id = String(params.id || '').trim();
    if (!id) return json(400, { ok: false, error: 'Missing lead id' });

    // @ts-expect-error injected by Pages
    const db = env.DB as D1Database;

    const lead = await db
      .prepare('SELECT * FROM leads WHERE id = ? LIMIT 1')
      .bind(id)
      .first();

    if (!lead) return json(404, { ok: false, error: 'Lead not found' });

    const answers = await db
      .prepare('SELECT question, answer FROM lead_answers WHERE lead_id = ? ORDER BY question')
      .bind(id)
      .all();

    const scores = await db
      .prepare('SELECT * FROM lead_scores WHERE lead_id = ? LIMIT 1')
      .bind(id)
      .first();

    return json(200, {
      ok: true,
      item: {
        lead,
        answers: answers.results ?? [],
        scores,
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: 'Lead detail failed',
      message: e?.message ?? String(e),
    });
  }
};
