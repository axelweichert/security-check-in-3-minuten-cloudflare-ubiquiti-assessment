import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Env = { DB: D1Database };

const QUESTION_LABELS: Record<string, string> = {
  vpn_in_use: "VPN im Einsatz",
  critical_processes_on_website: "Kritische Prozesse über die Website erreichbar",
  awareness_training: "Security-Awareness / Schulungen",
  vpn_solution: "VPN-Lösung",
  vpn_users: "Anzahl VPN-Nutzer",
  hosting_type: "Hosting",
  web_protection: "Web-Schutz",
  security_incidents: "Sicherheitsvorfälle in letzter Zeit",
  remote_access_satisfaction: "Zufriedenheit Remote-Zugriff",
  infrastructure_resilience: "Resilienz der IT-Infrastruktur",
  financial_damage_risk: "Finanzielles Schadensrisiko",
  firewall_vendor: "Firewall-Hersteller",
  vpn_technology: "VPN-Technologie",
  zero_trust_vendor: "Zero-Trust-Anbieter",
  company_name: "Unternehmen",
  contact_name: "Kontaktperson",
  email: "E-Mail-Adresse",
  phone: "Telefonnummer",
  employee_range: "Mitarbeiteranzahl",
  consent_contact: "Kontaktaufnahme erlaubt",
  consent_tracking: "Tracking erlaubt",
  discount_opt_in: "Rabatt-Informationen gewünscht",
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  yes: { yes: "Ja", no: "Nein" },
  awareness_training: { yes: "Ja", partially: "Teilweise", no: "Nein" },
  remote_access_satisfaction: { satisfied: "Zufrieden", neutral: "Neutral", unsatisfied: "Unzufrieden" },
  infrastructure_resilience: { high: "Hoch", medium: "Mittel", low: "Niedrig" },
  financial_damage_risk: { less_than_5k: "Unter 5.000 €", "5k_to_25k": "5.000 – 25.000 €", more_than_25k: "Über 25.000 €" },
  vpn_solution: { dedicated_vpn: "Dedizierte VPN-Lösung", firewall_vpn: "Firewall-VPN", vpn_gateway: "VPN-Gateway", zero_trust: "Zero Trust", ztna: "ZTNA", none: "Keine" },
  vpn_users: { "1_9": "1–9", less_than_10: "Unter 10", "10_49": "10–49", "10_to_50": "10–50", "50_plus": "50+", more_than_50: "Über 50" },
  hosting_type: { cloud: "Cloud", cloud_hosting: "Cloud Hosting", managed_hosting: "Managed Hosting", on_prem: "On-Premises", saas: "SaaS" },
  web_protection: { none: "Kein Schutz", basic: "Basisschutz", waf: "Web Application Firewall (WAF)", waf_ddos: "WAF + DDoS-Schutz", "waf+ddos": "WAF + DDoS-Schutz" },
  employee_range: { "1_9": "1–9 Mitarbeiter", "10_49": "10–49 Mitarbeiter", "50_199": "50–199 Mitarbeiter", "200_999": "200–999 Mitarbeiter", "1000_plus": "1.000+ Mitarbeiter" },
  consent_contact: { "1": "Ja", "0": "Nein" },
  consent_tracking: { "1": "Ja", "0": "Nein" },
  discount_opt_in: { "1": "Ja", "0": "Nein" },
  zero_trust_vendor: { no: "Keiner", cloudflare: "Cloudflare" },
};

function toGermanQA(key: string, value: unknown) {
  const raw = String(value ?? "");
  const question = QUESTION_LABELS[key] ?? key;

  const perKey = VALUE_LABELS[key];
  if (perKey && perKey[raw] != null) return { question, answer: perKey[raw] };

  const yesNo = VALUE_LABELS.yes;
  if (yesNo && yesNo[raw] != null) return { question, answer: yesNo[raw] };

  return { question, answer: raw };
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const cleaned = (text ?? "").toString().replace(/\s+/g, " ").trim();
  if (!cleaned) return ["-"];
  const words = cleaned.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const leadId = (params as any)?.leadId as string | undefined;
  if (!leadId) return new Response("Missing leadId", { status: 400 });

  // --- Load lead
  const leadRes = await env.DB.prepare(`SELECT * FROM leads WHERE id = ? LIMIT 1`).bind(leadId).all();
  const lead = ((leadRes as any).results?.[0] ?? null) as any;
  if (!lead) return new Response("Lead not found", { status: 404 });

  // --- Load answers (entscheidend: genau diese Query wie im result-endpoint)
  const ansRes = await env.DB
    .prepare(`SELECT id, lead_id, question_key, answer_value FROM lead_answers WHERE lead_id = ? ORDER BY rowid ASC`)
    .bind(leadId)
    .all();

  const answersRaw = (((ansRes as any).results ?? []) as any[]).map((a) => ({
    question_key: a.question_key,
    answer_value: a.answer_value,
  }));

  const answers =
    answersRaw.length > 0 ? answersRaw : [{ question_key: "-", answer_value: "Keine Antworten vorhanden" }];

  // --- PDF
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  let page = pdf.addPage(pageSize);
  let { width, height } = page.getSize();

  const marginX = 48;
  let y = height - 56;

  // Header
  page.drawText("Security-Check in 3 Minuten", { x: marginX, y, size: 18, font: bold });
  y -= 22;
  page.drawText(String(lead.company_name ?? "—"), { x: marginX, y, size: 12, font: bold });
  y -= 18;
  page.drawText(`Lead-ID: ${leadId}`, { x: marginX, y, size: 10.5, font });
  y -= 26;

  // Section title
  
  // --- Gesamtergebnis
  page.drawText("Gesamtergebnis", { x: marginX, y, size: 13, font: bold });
  y -= 18;

  page.drawText(`${scores.score_total}%`, { x: marginX, y, size: 26, font: bold });
  y -= 22;

  page.drawText(riskLabelDe(scores.risk_level), { x: marginX, y, size: 12, font: bold });
  y -= 22;

  page.drawText("Teilbereiche", { x: marginX, y, size: 12, font: bold });
  y -= 16;

  page.drawText(`VPN ${scores.score_vpn}/2`, { x: marginX, y, size: 10.5, font });
  y -= 14;
  page.drawText(`Web ${scores.score_web}/3`, { x: marginX, y, size: 10.5, font });
  y -= 14;
  page.drawText(`Awareness ${scores.score_awareness}/2`, { x: marginX, y, size: 10.5, font });
  y -= 22;
page.drawText("Ihre Antworten", { x: marginX, y, size: 13, font: bold });
  y -= 18;

  // Table header
  const fontSize = 10.5;
  const lineH = 14;
  const maxW = width - marginX * 2;
  const keyW = 210;
  const gap = 12;
  const valW = maxW - keyW - gap;

  page.drawText("Frage", { x: marginX, y, size: 10.5, font: bold });
  page.drawText("Antwort", { x: marginX + keyW + gap, y, size: 10.5, font: bold });
  y -= 10;
  page.drawLine({ start: { x: marginX, y }, end: { x: marginX + maxW, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 12;

  for (const a of answers) {
    const { question, answer } = toGermanQA(String(a.question_key ?? ""), a.answer_value);

    // Page break
    if (y < 80) {
      page = pdf.addPage(pageSize);
      ({ width, height } = page.getSize());
      y = height - 56;
      page.drawText("Ihre Antworten (Fortsetzung)", { x: marginX, y, size: 13, font: bold });
      y -= 26;
    }

    const qLines = wrapText(question, bold, fontSize, keyW);
    const aLines = wrapText(answer, font, fontSize, valW);
    const rows = Math.max(qLines.length, aLines.length);

    for (let i = 0; i < rows; i++) {
      page.drawText(qLines[i] ?? "", { x: marginX, y: y - i * lineH, size: fontSize, font: bold, color: rgb(0,0,0) });
      page.drawText(aLines[i] ?? "", { x: marginX + keyW + gap, y: y - i * lineH, size: fontSize, font, color: rgb(0,0,0) });
    }

    y = y - rows * lineH - 6;

    page.drawLine({
      start: { x: marginX, y: y + 4 },
      end: { x: marginX + maxW, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });
  }

  // Footer
  page.drawText(`Generated: ${new Date().toISOString()}`, { x: marginX, y: 36, size: 9, font, color: rgb(0.3,0.3,0.3) });

  const bytes = await pdf.save();
  return new Response(bytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="Security-Check-in-3-Minuten.pdf"',
    },
  });
};
