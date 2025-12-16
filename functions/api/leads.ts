export const onRequestGet: PagesFunction = async ({ env }) => {
  // If D1 binding is missing, return a helpful error.
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: "DB binding 'DB' missing in Pages project settings" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const { results } = await env.DB.prepare(
    `SELECT id, company_name, contact_name, email, phone, employee_range, created_at
     FROM leads
     ORDER BY created_at DESC
     LIMIT 50`
  ).all();

  return new Response(JSON.stringify({ ok: true, leads: results }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
