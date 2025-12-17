type LeadInput = Record<string, any>;

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

const inferFallbackByType = (declType: string | null | undefined) => {
  const t = (declType ?? "").toUpperCase();

  // SQLite type affinity (rough)
  if (t.includes("INT") || t.includes("BOOL")) return 0;
  if (t.includes("REAL") || t.includes("FLOA") || t.includes("DOUB") || t.includes("NUM")) return 0;
  if (t.includes("BLOB")) return new Uint8Array(); // very rare; avoids null for NOT NULL blobs
  // default: TEXT-ish
  return "unknown";
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

async function getLeadsTableInfo(env: Env) {
  // D1 returns rows under .results
  const res = await env.DB.prepare(`PRAGMA table_info(leads);`).all();
  const rows = (res as any).results as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: any;
    pk: number;
  }>;

  if (!rows || rows.length === 0) throw new Error("Schema error: PRAGMA table_info(leads) returned no rows");
  return rows;
}

function pickValueForColumn(colName: string, body: LeadInput, req: Request, now: string, leadId: string) {
  // Common canonical mapping (extendable)
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
      return body.consent_contact ? 1 : 0;

    case "consent_tracking":
      return body.consent_tracking ? 1 : 0;

    case "discount_opt_in":
    case "discount":
      return body.discount_opt_in ? 1 : 0;

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
      // If payload contains a matching key, use it
      if (Object.prototype.hasOwnProperty.call(body, colName)) return body[colName];
      return undefined;
  }
}

export const onRequestGet: PagesFunction<Env> = async () => {
  return json(405, { ok: false, error: "Method Not Allowed. Use POST /api/submit" });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json(500, { ok: false, error: "DB binding missing (expected env.DB)" });

    let body: LeadInput;
    try {
      body = (await request.json()) as LeadInput;
      const formData: LeadInput =
        (body && typeof body === "object" && (body as any).formData && typeof (body as any).formData === "object")
          ? ((body as any).formData as LeadInput)
          : (body as LeadInput);
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const now = new Date().toISOString();
    const leadId = crypto.randomUUID();

    // Read schema and build a safe INSERT dynamically
    const cols = await getLeadsTableInfo(env);

    const colNames: string[] = [];
    const placeholders: string[] = [];
    const values: any[] = [];

    for (const c of cols) {
      const name = c.name;

      // Strategy:
      // - If column has DB default, omit it unless we have an explicit value.
      // - If NOT NULL without default, we MUST provide something.
      // - If nullable, provide value if we have it; else omit (keeps NULL / default behavior).
      const hasDefault = c.dflt_value !== null && c.dflt_value !== undefined;
      const isNotNull = !!c.notnull;

      const picked = pickValueForColumn(name, body, request, now, leadId);
      const hasPicked =
        picked !== undefined &&
        picked !== null &&
        !(typeof picked === "string" && picked.trim().length === 0);

      if (hasPicked) {
        colNames.push(name);
        placeholders.push("?");
        values.push(picked);
        continue;
      }

      if (hasDefault) {
        // Let DB default handle it
        continue;
      }

      if (isNotNull) {
        // Must provide fallback
        let fallback: any;

        // Special cases: keep your lead minimum viable data clean
        if (name === "phone") fallback = normalizePhone(body.phone);
        else if (name === "employee_range") fallback = normalizeEmployeeRange(body.employee_range);
        else if (name === "firewall_vendor") fallback = normalizeVendor(body.firewall_vendor);
        else if (name === "vpn_technology") fallback = normalizeVendor(body.vpn_technology);
        else if (name === "language") fallback = detectLang(body, request);
        else if (name === "created_at" || name === "updated_at") fallback = now;
        else if (name === "status") fallback = "new";
        else if (name === "id") fallback = leadId;
        else fallback = inferFallbackByType(c.type);

        colNames.push(name);
        placeholders.push("?");
        values.push(fallback);
      }
      // else: nullable without default and no value => omit
    }

    // Minimal sanity: ensure we have an ID column if it exists in schema and was not added
    if (cols.some((x) => x.name === "id") && !colNames.includes("id")) {
      colNames.push("id");
      placeholders.push("?");
      values.push(leadId);
    }

    const sql = `INSERT INTO leads (${colNames.join(", ")}) VALUES (${placeholders.join(", ")});`;
    await env.DB.prepare(sql).bind(...values).run();

    // Optional: write answers if table exists (failsafe)
    if (body.answers && typeof body.answers === "object") {
      try {
        for (const [question, answer] of Object.entries(body.answers)) {
          await env.DB.prepare(
            `INSERT INTO lead_answers (lead_id, question_key, answer_value, created_at)
             VALUES (?, ?, ?, ?)`
          )
            .bind(
              leadId,
              question,
              typeof answer === "string" ? answer : JSON.stringify(answer),
              now
            )
            .run();
        }
      } catch (e) {
        // Do not fail lead creation if answers table differs
        console.error("lead_answers insert warning:", e);
      }
    }

    // Optional: write score if table exists (failsafe)
    if (body.score) {
      try {
        await env.DB.prepare(
          `INSERT INTO lead_scores (lead_id, total, percent, rating, breakdown_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(
            leadId,
            Number(body.score.total ?? 0),
            Number(body.score.percent ?? 0),
            (body.score.rating ?? "medium").toString(),
            JSON.stringify(body.score.breakdown ?? {}),
            now
          )
          .run();
      } catch (e) {
        console.error("lead_scores insert warning:", e);
      }
    }

    return json(200, { ok: true, lead_id: leadId });
  } catch (err: any) {
    console.error("submit error:", err);
    return json(500, {
      ok: false,
      error: "Submit failed",
      message: String(err?.message ?? err),
      name: err?.name,
    });
  }
};
