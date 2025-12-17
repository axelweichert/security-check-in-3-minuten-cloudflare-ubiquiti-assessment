type Env = { DB: D1Database };

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Sehr minimalistisches, valides 1-Seiten-PDF (Text-only)
function makeSimplePdf(lines: string[]) {
  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const contentLines = [];
  let y = 780;
  for (const l of lines.slice(0, 35)) {
    contentLines.push(`BT /F1 12 Tf 50 ${y} Td (${esc(l)}) Tj ET`);
    y -= 18;
  }
  const stream = contentLines.join("\n") + "\n";

  const parts: string[] = [];
  const offsets: number[] = [0];

  const push = (str: string) => {
    offsets.push((parts.join("").length));
    parts.push(str);
  };

  // Header
  parts.push("%PDF-1.4\n");
  // 1: Catalog
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  // 2: Pages
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  // 3: Page
  push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n");
  // 4: Contents
  push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
  // 5: Font
  push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  const xrefStart = parts.join("").length;
  const objCount = 6;

  let xref = "xref\n0 " + objCount + "\n";
  xref += "0000000000 65535 f \n";
  for (let i = 1; i < objCount; i++) {
    const off = offsets[i + 0]; // offsets hat 0 + push markers
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }

  const trailer =
    "trailer\n<< /Size " + objCount + " /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF\n";

  const pdfStr = parts.join("") + xref + trailer;
  return new TextEncoder().encode(pdfStr);
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const leadId = (params as any).leadId as string;
    if (!leadId) return json(400, { ok: false, error: "Missing leadId" });

    const leadRes = await env.DB.prepare(
      `SELECT id, company_name, contact_name, email, language, created_at FROM leads WHERE id = ? LIMIT 1`
    ).bind(leadId).first();

    if (!leadRes) return json(404, { ok: false, error: "Lead not found" });

    // Scores (falls Tabelle/Spalten existieren)
    let scoreTotal = 0;
    let risk = "high";
    try {
      const s = await env.DB.prepare(
        `SELECT score_total, risk_level FROM lead_scores_view WHERE lead_id = ? LIMIT 1`
      ).bind(leadId).first();
      if (s && (s as any).score_total != null) scoreTotal = Number((s as any).score_total) || 0;
      if (s && (s as any).risk_level) risk = String((s as any).risk_level);
    } catch {
      // ignore
    }

    const lines = [
      "Security-Check Ergebnis",
      "",
      `Lead ID: ${leadId}`,
      `Firma: ${(leadRes as any).company_name ?? ""}`,
      `Kontakt: ${(leadRes as any).contact_name ?? ""}`,
      `E-Mail: ${(leadRes as any).email ?? ""}`,
      `Erstellt: ${(leadRes as any).created_at ?? ""}`,
      "",
      `Score: ${scoreTotal}%`,
      `Risiko: ${risk}`,
      "",
      "Hinweis: Minimal-PDF. Layout/Branding kann danach verbessert werden."
    ];

    const pdf = makeSimplePdf(lines);
    return new Response(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="Security-Check_${leadId}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, error: "PDF generation failed", message: String(e?.message ?? e) });
  }
};
