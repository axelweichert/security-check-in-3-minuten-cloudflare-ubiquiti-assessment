import type { PagesFunction } from '@cloudflare/workers-types';
import type { GetLeadResponse } from '@shared/types';

type Env = { DB: D1Database };

async function getTableColumns(env: Env, table: string): Promise<Set<string>> {
  const res = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const cols = new Set<string>();
  for (const row of ((res as any).results ?? []) as any[]) cols.add(String(row.name));
  return cols;
}

function toIso(v: any): string | null {
  if (!v) return null;
  const s = String(v);
  // akzeptiere bereits ISO-Strings; ansonsten best-effort Date parse
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return s;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const leadId = (params as any)?.id as string | undefined;
  if (!leadId) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing id' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  try {
    // Lead laden (SELECT * -> keine kaputten Spalten-Referenzen)
    const leadRes = await env.DB.prepare('SELECT * FROM leads WHERE id = ? LIMIT 1').bind(leadId).all();
    const lead = ((leadRes as any).results?.[0] ?? null) as any;
    if (!lead) {
      return new Response(JSON.stringify({ ok: false, error: 'Not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    // Antworten laden
    const ansRes = await env.DB
      .prepare('SELECT id, lead_id, question_key, answer_value, score_value FROM lead_answers WHERE lead_id = ? ORDER BY rowid ASC')
      .bind(leadId)
      .all();
    const answers = (((ansRes as any).results ?? []) as any[]).map((a) => ({
      id: a.id,
      lead_id: a.lead_id,
      question_key: a.question_key,
      answer_value: a.answer_value,
      score_value: a.score_value,
    }));

    // Scores optional (Tabelle existiert ggf. nicht in alten Schemas)
    let scores: any = null;
    try {
      const scRes = await env.DB.prepare('SELECT * FROM lead_scores WHERE lead_id = ? LIMIT 1').bind(leadId).all();
      scores = ((scRes as any).results?.[0] ?? null) as any;
    } catch {
      scores = null;
    }

    // created_at normalisieren (Frontend erwartet created_at)
    // Unterstützt alte DBs (created / createdAt / timestamp) und neue (created_at)
    const created =
      toIso(lead.created_at) ??
      toIso(lead.created) ??
      toIso(lead.createdAt) ??
      toIso(lead.timestamp) ??
      toIso(lead.submitted_at) ??
      new Date().toISOString();

    // Patch lead-Objekt so, dass created_at garantiert vorhanden ist
    lead.created_at = created;

    const payload: GetLeadResponse = { ok: true, item: { lead, answers, scores } };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to load lead', message: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ params, env, request }) => {
  const leadId = (params as any)?.id as string | undefined;
  if (!leadId) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing id' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  try {
    const body = (await request.json().catch(() => null)) as any;
    const status = String(body?.status ?? '').toLowerCase();
    if (status !== 'new' && status !== 'done') {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid status' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    // Schema-compat: done_at existiert ggf. nicht
    const cols = await getTableColumns(env, 'leads');
    const hasDoneAt = cols.has('done_at');

    if (hasDoneAt) {
      const doneAt = status === 'done' ? new Date().toISOString() : null;
      await env.DB.prepare('UPDATE leads SET status = ?, done_at = ? WHERE id = ?').bind(status, doneAt, leadId).run();
    } else {
      await env.DB.prepare('UPDATE leads SET status = ? WHERE id = ?').bind(status, leadId).run();
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to update status', message: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
};
