type LeadInput = Record<string, any>;

type Env = {
  DB: D1Database;
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const detectLang = (body: LeadInput, req: Request) => {
  const v = (body?.language ?? body?.lang ?? "").toString().toLowerCase();
  if (v.startsWith("fr")) return "fr";
  if (v.startsWith("en")) return "en";
  if (v.startsWith("de")) return "de";

  const al = (req.headers.get("accept-language") ?? "").toLowerCase();
  if (al.startsWith("fr")) return "fr";
  if (al.startsWith("en")) return "en";
  return "de";
};

const normalizePhone = (v: any) => {
  const s = (v ?? "").toString().trim();
  return s.length > 0 ? s : "n/a";
};

const normalizeEmployeeRange = (v: any) => {
  const s = (v ?? "").toString().trim();
  return s.length > 0 ? s : "unknown";
};

const normalizeVendor = (v: any) => {
  const s = (v ?? "").toString().trim();
  return s.length > 0 ? s : "unknown";
};

function asInt01(v: any): 0 | 1 {
  if (v === 1 || v === "1" || v === true || v === "true") return 1;
  return 0;
}

function pickLeadValue(colName: string, body: LeadInput, req: Request, now: string, leadId: string) {
  switch (colName) {
    case "id":
      return leadId;

    case "company_name":
    case "company":
    case "firma":
      return (body.company_name ?? body.company ?? body.firma ?? "").toString().trim();

    case "contact_name":
    case "contact":
    case "ansprechpartner":
      return (body.contact_name ?? body.contact ?? body.ansprechpartner ?? "").toString().trim();

    case "email":
    case "email_address":
      return (body.email ?? body.email_address ?? "").toString().trim();

    case "phone":
    case "telefon":
      return normalizePhone(body.phone ?? body.telefon);

    case "employee_range":
    case "employees":
    case "mitarbeiteranzahl":
      return normalizeEmployeeRange(body.employee_range ?? body.employees ?? body.mitarbeiteranzahl);

    case "firewall_vendor":
    case "firewall":
      return normalizeVendor(body.firewall_vendor ?? body.firewall);

    case "vpn_technology":
    case "vpn_tech":
      return normalizeVendor(body.vpn_technology ?? body.vpn_tech);

    case "vpn_solution":
      return normalizeVendor(body.vpn_solution);

    case "zero_trust_vendor":
    case "zero_trust":
      return normalizeVendor(body.zero_trust_vendor ?? body.zero_trust);

    case "consent_contact":
      return asInt01(body.consent_contact);

    case "consent_tracking":
      return asInt01(body.consent_tracking);

    case "discount_opt_in":
    case "discount":
      return asInt01(body.discount_opt_in);

    case "language":
    case "lang":
      return detectLang(body, req);

    case "created_at":
    case "created":
      return now;

    case "updated_at":
    case "updated":
      return now;

    case "status":
      return (body.status ?? "new").toString();

    case "source":
      return (body.source ?? "security-check").toString();

    default:
      return undefined;
  }
}

function extractFormData(body: LeadInput): LeadInput {
  const fd = body?.formData;
  if (fd && typeof fd === "object" && !Array.isArray(fd)) return fd as LeadInput;

  const blacklist = new Set([
    "id",
    "company_name",
    "company",
    "firma",
    "contact_name",
    "contact",
    "ansprechpartner",
    "email",
    "email_address",
    "phone",
    "telefon",
    "employee_range",
    "employees",
    "mitarbeiteranzahl",
    "firewall_vendor",
    "firewall",
    "vpn_technology",
    "vpn_tech",
    "vpn_solution",
    "zero_trust_vendor",
    "zero_trust",
    "consent_contact",
    "consent_tracking",
    "discount_opt_in",
    "discount",
    "language",
    "lang",
    "status",
    "source",
    "created_at",
    "updated_at",
    "formData",
  ]);

  const out: LeadInput = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (blacklist.has(k)) continue;
    if (v === undefined) continue;
    if (Array.isArray(v)) out[k] = v.join(", ");
    else out[k] = v;
  }
  return out;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json()) as LeadInput;

    const leadId = crypto.randomUUID();
    const now = new Date().toISOString();

    // leads: dynamisch auf existierende Spalten mappen
    const info = await env.DB.prepare(`PRAGMA table_info(leads);`).all();
    const cols = ((info as any).results ?? []) as Array<{ name: string }>;
    if (!cols.length) return json(500, { ok: false, error: "Schema error", message: "PRAGMA table_info(leads) empty" });

    const insertCols: string[] = [];
    const insertVals: any[] = [];
    const placeholders: string[] = [];

    for (const c of cols) {
      const v = pickLeadValue(c.name, body, request, now, leadId);
      if (v === undefined) continue;
      insertCols.push(c.name);
      insertVals.push(v);
      placeholders.push("?");
    }

    await env.DB.prepare(`INSERT INTO leads (${insertCols.join(",")}) VALUES (${placeholders.join(",")})`).bind(...insertVals).run();

    // lead_answers: OHNE created_at (Schema hat die Spalte nicht)
    const formData = extractFormData(body);

    await env.DB.prepare(`DELETE FROM lead_answers WHERE lead_id = ?`).bind(leadId).run();

    const entries = Object.entries(formData).filter(([k, v]) => k && v !== undefined && v !== null && `${v}`.length > 0);
    for (const [question_key, rawVal] of entries) {
      const answer_value = Array.isArray(rawVal) ? rawVal.join(", ") : `${rawVal}`;
      await env.DB
        .prepare(`INSERT INTO lead_answers (lead_id, question_key, answer_value) VALUES (?, ?, ?)`)
        .bind(leadId, question_key, answer_value)
        .run();
    }

    return json(200, { ok: true, lead_id: leadId });
  } catch (e: any) {
    return json(500, { ok: false, error: "Submit failed", message: e?.message ?? String(e) });
  }
};

export const onRequestGet: PagesFunction<Env> = async () => json(200, { ok: true });
