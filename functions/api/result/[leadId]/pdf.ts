type Env = { DB: D1Database };

function pdfEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Minimal-PDF Generator (1 Seite, Helvetica, Textzeilen)
function makePdf(lines: string[]) {
  const fontObj = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  const contentLines: string[] = [];
  let y = 780;
  for (const line of lines) {
    const t = pdfEscape(line);
    contentLines.push(`BT /F1 12 Tf 50 ${y} Td (${t}) Tj ET`);
    y -= 16;
    if (y < 60) break;
  }
  const contentStream = contentLines.join("\n");
  const streamObj = `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`;

  // Build objects
  const objs: string[] = [];
  objs.push(""); // 0 unused
  objs.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objs.push(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
  objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`);
  objs.push(fontObj);
  objs.push(streamObj);

  // xref
  let out = `%PDF-1.4\n`;
  const offsets: number[] = [0];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefPos = out.length;
  out += `xref\n0 ${objs.length}\n`;
  out += `0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  return new TextEncoder().encode(out);
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const leadId = (params as any)?.leadId as string | undefined;
  if (!leadId) return json(400, { ok: false, error: "Missing leadId" });

  try {
    const leadRes = await env.DB.prepare(`SELECT * FROM leads WHERE id = ? LIMIT 1`).bind(leadId).all();
    const lead = ((leadRes as any).results?.[0] ?? null) as any;
    if (!lead) return json(404, { ok: false, error: "Not found", message: "Lead not found" });

    const scoreRes = await env.DB
      .prepare(`SELECT * FROM lead_scores WHERE lead_id = ? ORDER BY rowid DESC LIMIT 1`)
      .bind(leadId)
      .all();
    const scoreRow = ((scoreRes as any).results?.[0] ?? null) as any;

    // Fallback, falls lead_scores nicht passt
    const score_total = Number(scoreRow?.percent ?? scoreRow?.score_total ?? scoreRow?.total ?? 0) || 0;
    const risk_level = String(scoreRow?.rating ?? scoreRow?.risk_level ?? "unknown");

    const lines = [
      "Security-Check in 3 Minuten",
      "",
      `Lead-ID: ${leadId}`,
      `Firma: ${lead.company_name ?? ""}`,
      `Kontakt: ${lead.contact_name ?? ""}`,
      `E-Mail: ${lead.email ?? ""}`,
      "",
      `Score: ${Math.max(0, Math.min(100, Math.round(score_total)))}%`,
      `Risiko: ${risk_level}`,
      "",
      "Hinweis: Dies ist eine generierte Kurz-Zusammenfassung.",
    ];

    const pdfBytes = makePdf(lines);

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="Security-Check-in-3-Minuten_${leadId}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, error: "PDF generation failed", message: e?.message ?? String(e) });
  }
};
