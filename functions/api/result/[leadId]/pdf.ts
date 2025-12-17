type Env = { DB: D1Database };

function pdfEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Minimal-PDF (1 Seite, Text) – robust genug für Reader/Download
function makeSimplePdf(lines: string[]) {
  const contentLines = lines.map((l, i) => `72 ${760 - i * 18} Td (${pdfEscape(l)}) Tj T*`).join("\n");
  const stream = `BT\n/F1 12 Tf\n${contentLines}\nET`;

  // PDF objects
  const objs: string[] = [];
  objs.push(`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`);
  objs.push(`2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`);
  objs.push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`);
  objs.push(`4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  objs.push(`5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);

  let offset = 0;
  const header = `%PDF-1.4\n`;
  offset += header.length;

  const xref: number[] = [0];
  const bodyParts: string[] = [];
  for (const obj of objs) {
    xref.push(offset);
    bodyParts.push(obj + "\n");
    offset += (obj.length + 1);
  }

  const xrefStart = offset;
  let xrefTable = `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < xref.length; i++) {
    xrefTable += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  const pdf = header + bodyParts.join("") + xrefTable + trailer;
  return new TextEncoder().encode(pdf);
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const leadId = (params as any)?.leadId as string | undefined;
  if (!leadId) return new Response("Missing leadId", { status: 400 });

  const leadRes = await env.DB.prepare(`SELECT company_name, language FROM leads WHERE id = ? LIMIT 1`).bind(leadId).all();
  const lead = ((leadRes as any).results?.[0] ?? null) as any;
  if (!lead) return new Response("Not found", { status: 404 });

  const resultRes = await env.DB.prepare(`SELECT question_key, answer_value FROM lead_answers WHERE lead_id = ?`).bind(leadId).all();
  const answers = ((resultRes as any).results ?? []) as Array<{ question_key: string; answer_value: string }>;
  const answerMap = new Map(answers.map((a) => [a.question_key, a.answer_value]));

  // gleiche Score-Logik wie API
  const isMeaningful = (v?: string) => {
    const s = (v ?? "").trim().toLowerCase();
    if (!s) return false;
    if (["unknown", "dont_know", "n/a", "na", "none"].includes(s)) return false;
    return true;
  };
  const groups = {
    vpn: ["vpn_in_use", "vpn_solution", "vpn_users", "vpn_technology", "remote_access_satisfaction"],
    web: ["critical_processes_on_website", "hosting_type", "web_protection", "security_incidents"],
    awareness: ["awareness_training", "infrastructure_resilience", "financial_damage_risk"],
  } as const;

  const score_vpn = Math.min(2, groups.vpn.reduce((a, k) => a + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0));
  const score_web = Math.min(3, groups.web.reduce((a, k) => a + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0));
  const score_awareness = Math.min(2, groups.awareness.reduce((a, k) => a + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0));
  const score_total = Math.round(((score_vpn + score_web + score_awareness) / 7) * 100);

  const pdfBytes = makeSimplePdf([
    "Security-Check in 3 Minuten",
    `Lead ID: ${leadId}`,
    `Firma: ${lead.company_name ?? ""}`,
    `Score: ${score_total}%`,
    "",
    "Hinweis: Dieses PDF ist eine Minimalversion (Text).",
  ]);

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="Security-Check-in-3-Minuten_${leadId}.pdf"`,
      "cache-control": "no-store",
    },
  });
};
