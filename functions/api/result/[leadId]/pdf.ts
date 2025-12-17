type Env = { DB: D1Database };

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Minimal valides 1-Seiten-PDF (Text)
function makeSimplePdf(lines: string[]) {
  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let y = 780;
  const stream = lines.slice(0, 35).map(l => {
    const s = `BT /F1 12 Tf 50 ${y} Td (${esc(l)}) Tj ET`;
    y -= 18;
    return s;
  }).join("\n") + "\n";

  const parts: string[] = [];
  const obj: string[] = [];

  parts.push("%PDF-1.4\n");
  obj.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  obj.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  obj.push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n");
  obj.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
  obj.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  const offsets: number[] = [0];
  for (const o of obj) {
    offsets.push(parts.join("").length);
    parts.push(o);
  }

  const xrefStart = parts.join("").length;
  let xref = `xref\n0 ${obj.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i <= obj.length; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }

  const trailer =
    `trailer\n<< /Size ${obj.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(parts.join("") + xref + trailer);
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const leadId = (params as any).leadId as string;
    if (!leadId) return json(400, { ok: false, error: "Missing leadId" });

    const lead = await env.DB.prepare(
      `SELECT id, company_name, contact_name, email, created_at FROM leads WHERE id = ? LIMIT 1`
    ).bind(leadId).first();

    if (!lead) return json(404, { ok: false, error: "Lead not found" });

    const lines = [
      "Security-Check Ergebnis",
      "",
      `Lead ID: ${leadId}`,
      `Firma: ${(lead as any).company_name ?? ""}`,
      `Kontakt: ${(lead as any).contact_name ?? ""}`,
      `E-Mail: ${(lead as any).email ?? ""}`,
      `Erstellt: ${(lead as any).created_at ?? ""}`,
      "",
      "PDF Endpoint OK (Minimal-PDF).",
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
