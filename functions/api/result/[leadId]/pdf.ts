
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function normalizeRiskFromPercent(pct: number) { return pct >= 75 ? "low" : pct >= 40 ? "medium" : "high"; }
function riskLabelDe(risk: string) { return risk === "low" ? "Niedriges Risiko" : risk === "medium" ? "Mittleres Risiko" : "Hohes Risiko"; }
function computeScoresFromAnswers(items: { question_key: string; answer_value: any }[]) {
  const m = new Map<string, string>();
  for (const a of items) m.set(String(a.question_key ?? ""), String(a.answer_value ?? ""));
  const get = (k: string) => (m.get(k) ?? "").toString();

  let vpn = 0;
  const vpnInUse = get("vpn_in_use"); if (vpnInUse === "yes") vpn += 0.5;
  const vpnTech = get("vpn_technology");
  if (vpnTech === "wireguard" || vpnTech === "ipsec") vpn += 0.75;
  else if (vpnTech === "sslvpn") vpn += 0.35;
  else if (vpnTech === "pptp") vpn += 0.0;
  const vpnSol = get("vpn_solution");
  if (vpnSol === "zero_trust" || vpnSol === "ztna") vpn += 0.75;
  else if (vpnSol === "firewall_vpn" || vpnSol === "vpn_gateway") vpn += 0.45;
  const sat = get("remote_access_satisfaction");
  if (sat === "satisfied") vpn += 0.25;
  else if (sat === "neutral") vpn += 0.1;
  else if (sat === "unsatisfied") vpn += 0.0;
  const users = get("vpn_users");
  if (users === "less_than_10") vpn += 0.15;
  else if (users === "10_49") vpn += 0.1;
  else if (users) vpn += 0.05;
  const score_vpn = clamp(Math.round(vpn * 100) / 100, 0, 2);

  let web = 0;
  const critical = get("critical_processes_on_website");
  const hosting = get("hosting_type");
  const protection = get("web_protection");
  const incidents = get("security_incidents");
  if (hosting === "managed_hosting") web += 0.5;
  else if (hosting === "cloud" || hosting === "saas") web += 0.7;
  else if (hosting) web += 0.25;
  if (protection === "none") web += 0.0;
  else if (protection === "basic") web += 0.75;
  else if (protection === "waf") web += 1.6;
  else if (protection === "waf_ddos" || protection === "waf+ddos") web += 2.2;
  else if (protection) web += 1.0;
  if (critical === "yes" && protection === "none") web -= 0.8;
  if (incidents === "yes") web -= 0.7;
  const score_web = clamp(Math.round(web * 100) / 100, 0, 3);

  let aw = 0;
  const training = get("awareness_training");
  const resil = get("infrastructure_resilience");
  const dmg = get("financial_damage_risk");
  if (training === "yes") aw += 0.9;
  else if (training === "partially") aw += 0.45;
  if (resil === "high") aw += 0.7;
  else if (resil === "medium") aw += 0.35;
  if (dmg === "less_than_5k") aw += 0.4;
  else if (dmg === "5k_to_25k") aw += 0.2;
  else if (dmg) aw += 0.0;
  const score_awareness = clamp(Math.round(aw * 100) / 100, 0, 2);

  const score_total = clamp(Math.round(((score_vpn + score_web + score_awareness) / 7) * 100), 0, 100);
  const risk_level = normalizeRiskFromPercent(score_total);
  return { score_total, score_vpn, score_web, score_awareness, risk_level };
}


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

  remote_access_satisfaction: {
    satisfied: "Zufrieden",
    neutral: "Neutral",
    unsatisfied: "Unzufrieden",
  },

  infrastructure_resilience: { high: "Hoch", medium: "Mittel", low: "Niedrig" },

  financial_damage_risk: {
    less_than_5k: "Unter 5.000 €",
    "5k_to_25k": "5.000 – 25.000 €",
    more_than_25k: "Über 25.000 €",
  },

  vpn_solution: {
    dedicated_vpn: "Dedizierte VPN-Lösung",
    firewall_vpn: "Firewall-VPN",
    vpn_gateway: "VPN-Gateway",
    zero_trust: "Zero Trust",
    ztna: "ZTNA",
    none: "Keine",
  },

  vpn_users: {
    "1_9": "1–9",
    less_than_10: "Unter 10",
    "10_49": "10–49",
    "10_to_50": "10–50",
    "50_plus": "50+",
    more_than_50: "Über 50",
  },

  hosting_type: {
    cloud: "Cloud",
    cloud_hosting: "Cloud Hosting",
    managed_hosting: "Managed Hosting",
    on_prem: "On-Premises",
    saas: "SaaS",
  },

  web_protection: {
    none: "Kein Schutz",
    basic: "Basisschutz",
    waf: "Web Application Firewall (WAF)",
    waf_ddos: "WAF + DDoS-Schutz",
    "waf+ddos": "WAF + DDoS-Schutz",
  },

  employee_range: {
    "1_9": "1–9 Mitarbeiter",
    "10_49": "10–49 Mitarbeiter",
    "50_199": "50–199 Mitarbeiter",
    "200_999": "200–999 Mitarbeiter",
    "1000_plus": "1.000+ Mitarbeiter",
  },

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

type Env = { DB: D1Database };

const ANSWER_GROUPS = {
  vpn: ["vpn_in_use", "vpn_solution", "vpn_users", "vpn_technology", "remote_access_satisfaction"],
  web: ["critical_processes_on_website", "hosting_type", "web_protection", "security_incidents"],
  awareness: ["awareness_training", "infrastructure_resilience", "financial_damage_risk"],
} as const;

function isMeaningful(v: string | null | undefined) {
  const s = (v ?? "").toString().trim().toLowerCase();
  if (!s) return false;
  if (["unknown", "dont_know", "n/a", "na", "none", "no"].includes(s)) return false;
  return true;
}

function computeScores(answerMap: Map<string, string>) {
  const score_vpn = Math.min(2, ANSWER_GROUPS.vpn.reduce((acc, k) => acc + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0));
  const score_web = Math.min(3, ANSWER_GROUPS.web.reduce((acc, k) => acc + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0));
  const score_awareness = Math.min(2, ANSWER_GROUPS.awareness.reduce((acc, k) => acc + (isMeaningful(answerMap.get(k)) ? 1 : 0), 0));

  const maxTotal = 2 + 3 + 2;
  const totalPoints = score_vpn + score_web + score_awareness;
  const score_total = Math.round((totalPoints / maxTotal) * 100);

  const risk_level = score_total >= 75 ? "low" : score_total >= 40 ? "medium" : "high";
  return { score_total, score_vpn, score_web, score_awareness, risk_level };
}

function labelRisk(risk: string, lang: string) {
  const de: Record<string, string> = { low: "Niedriges Risiko", medium: "Mittleres Risiko", high: "Hohes Risiko" };
  const en: Record<string, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };
  const dict = (lang ?? "de").startsWith("de") ? de : en;
  return dict[risk] ?? risk;
}

function sanitizeText(v: unknown) {
  return (v ?? "").toString().replace(/\s+/g, " ").trim();
}

export const onRequestGet: PagesFunction<Env> = async ({
 params, env }) => {
  const leadId = (params as any)?.leadId as string | undefined;
  if (!leadId) return new Response("Missing leadId", { status: 400 });

  // Lazy import, damit pdf-lib nur geladen wird, wenn der PDF-Endpoint getroffen wird
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  try {
    const leadRes = await env.DB.prepare(`SELECT * FROM leads WHERE id = ? LIMIT 1`).bind(leadId).all();
    const lead = ((leadRes as any).results?.[0] ?? null) as any;
    if (!lead) return new Response("Not found", { status: 404 });

    const ansRes = await env.DB
      .prepare(`SELECT question_key, answer_value FROM lead_answers WHERE lead_id = ? ORDER BY rowid ASC`)
      .bind(leadId)
      .all();
    const answers = (((ansRes as any).results ?? []) as any[]).map((a) => ({
      question_key: a.question_key,
      answer_value: a.answer_value,
    }));


const printable = (answers && answers.length) ? answers : ([{ question_key: "-", answer_value: "Keine Antworten vorhanden" }] as any);
const scores = computeScoresFromAnswers(printable as any);

const printableAnswers = printable.map((a: any) => {
  const { question, answer } = toGermanQA(a.question_key, a.answer_value);
  return { ...a, question_label: question, answer_label: answer };
});

    const lang = sanitizeText(lead.language) || "de";

    // --- PDF LAYOUT ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait (pt)
  const marginX = 50;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = font;

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const M = 48; // margin
    const W = page.getWidth();
    const H = page.getHeight();
    let y = H - M;

    const drawText = (txt: string, x: number, y: number, size = 12, bold = false, color = rgb(0.12, 0.12, 0.12)) => {
      page.drawText(txt, { x, y, size, font: bold ? fontBold : font, color });
    };

    const wrapLines = (txt: string, maxWidth: number, size = 10) => {
      const words = sanitizeText(txt).split(" ").filter(Boolean);
      const lines: string[] = [];
      let line = "";
      const f = font;
      for (const w of words) {
        const candidate = line ? `${line} ${w}` : w;
        const width = f.widthOfTextAtSize(candidate, size);
        if (width <= maxWidth) {
          line = candidate;
        } else {
          if (line) lines.push(line);
          line = w;
        }
      }
      if (line) lines.push(line);
      return lines;
    };

    // Header
    drawText("Security-Check in 3 Minuten", M, y, 18, true);
    y -= 26;
    const company = sanitizeText(lead.company_name) || "—";
    drawText(company, M, y, 12, false, rgb(0.30, 0.30, 0.30));
    y -= 18;
    drawText(`Lead-ID: ${leadId}`, M, y, 9, false, rgb(0.45, 0.45, 0.45));
    y -= 20;

    // Divider
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: rgb(0.87, 0.87, 0.87) });
    y -= 22;

    // Score Card
    const cardH = 140;
    page.drawRectangle({ x: M, y: y - cardH, width: W - 2 * M, height: cardH, color: rgb(0.97, 0.97, 0.98), borderColor: rgb(0.90, 0.90, 0.92), borderWidth: 1 });
    drawText(lang.startsWith("de") ? "Gesamtergebnis" : "Overall result", M + 18, y - 32, 12, true, rgb(0.25, 0.25, 0.30));
    drawText(`${scores.score_total}%`, M + 18, y - 92, 48, true);

    const risk = labelRisk(scores.risk_level, lang);
    const badgeText = risk;
    const badgeSize = 11;
    const badgePadX = 10;
    const badgePadY = 6;
    const badgeW = fontBold.widthOfTextAtSize(badgeText, badgeSize) + badgePadX * 2;
    const badgeH = badgeSize + badgePadY * 2;

    const badgeX = W - M - badgeW - 18;
    const badgeY = y - 40;
    const riskColor =
      scores.risk_level === "low" ? rgb(0.13, 0.55, 0.35) :
      scores.risk_level === "medium" ? rgb(0.74, 0.52, 0.10) :
      rgb(0.72, 0.18, 0.20);

    page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: badgeH, color: rgb(1, 1, 1), borderColor: riskColor, borderWidth: 1.5 });
    page.drawText(badgeText, { x: badgeX + badgePadX, y: badgeY + badgePadY + 1, size: badgeSize, font: fontBold, color: riskColor });

    // Breakdown (right side)
    const bx = W - M - 240;
    const by = y - 92;
    drawText(lang.startsWith("de") ? "Teilbereiche" : "Sub-scores", bx, by + 46, 12, true, rgb(0.25, 0.25, 0.30));

    const row = (label: string, val: string, yy: number) => {
      drawText(label, bx, yy, 10, false, rgb(0.35, 0.35, 0.38));
      drawText(val, bx + 170, yy, 10, true, rgb(0.12, 0.12, 0.12));
    };
    row("VPN", `${scores.score_vpn}/2`, by + 26);
    row(lang.startsWith("de") ? "Web" : "Web", `${scores.score_web}/3`, by + 10);
    row(lang.startsWith("de") ? "Awareness" : "Awareness", `${scores.score_awareness}/2`, by - 6);

    y -= (cardH + 22);

    // Answers table
    drawText(lang.startsWith("de") ? "Ihre Antworten" : "Your answers", M, y, 13, true);
    y -= 16;

    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: rgb(0.87, 0.87, 0.87) });
    y -= 14;

    const col1W = 190;
    const col2W = (W - 2 * M) - col1W;

    drawText(lang.startsWith("de") ? "Frage (Key)" : "Question (key)", M, y, 10, true, rgb(0.25, 0.25, 0.30));
    drawText(lang.startsWith("de") ? "Antwort" : "Answer", M + col1W, y, 10, true, rgb(0.25, 0.25, 0.30));
    y -= 12;

    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: rgb(0.90, 0.90, 0.92) });
    y -= 10;

    const rowHeightBase = 12;

    // simple pagination: if table overflows, add pages
    let curPage = page;
    let curY = y;

    const newPage = () => {
      curPage = pdfDoc.addPage([595.28, 841.89]);
      curY = H - M;

      curPage.drawText("Security-Check in 3 Minuten", { x: M, y: curY, size: 14, font: fontBold, color: rgb(0.12, 0.12, 0.12) });
      curY -= 18;
      curPage.drawText(company, { x: M, y: curY, size: 10, font, color: rgb(0.35, 0.35, 0.38) });
      curY -= 14;

      curPage.drawLine({ start: { x: M, y: curY }, end: { x: W - M, y: curY }, thickness: 1, color: rgb(0.87, 0.87, 0.87) });
      curY -= 18;

      curPage.drawText(lang.startsWith("de") ? "Ihre Antworten (Fortsetzung)" : "Your answers (continued)", { x: M, y: curY, size: 12, font: fontBold, color: rgb(0.25, 0.25, 0.30) });
      curY -= 16;
    };

    const drawRow = (k: string, v: string) => {
      const kLines = wrapLines(k, col1W - 10, 9);
      const vLines = wrapLines(v, col2W - 10, 9);
      const lines = Math.max(kLines.length, vLines.length);
      const h = Math.max(rowHeightBase, lines * 11);

      if (curY - h < M + 40) newPage();

      // alternating background
      curPage.drawRectangle({
        x: M,
        y: curY - h + 3,
        width: W - 2 * M,
        height: h,
        color: rgb(0.99, 0.99, 1.0),
        borderColor: rgb(0.93, 0.93, 0.95),
        borderWidth: 0.5,
      });

      // key
      for (let i = 0; i < kLines.length; i++) {
        curPage.drawText(kLines[i], { x: M + 6, y: curY - 11 * (i + 1) + 2, size: 9, font: fontBold, color: rgb(0.20, 0.20, 0.22) });
      }
      // value
      for (let i = 0; i < vLines.length; i++) {
        curPage.drawText(vLines[i], { x: M + col1W + 6, y: curY - 11 * (i + 1) + 2, size: 9, font, color: rgb(0.15, 0.15, 0.16) });
      }

      // vertical divider
      curPage.drawLine({ start: { x: M + col1W, y: curY + 3 }, end: { x: M + col1W, y: curY - h + 3 }, thickness: 0.5, color: rgb(0.90, 0.90, 0.92) });

      curY -= (h + 6);
    };

    for (const a of printableAnswers) {
      const k = sanitizeText(a.question_label);
      const v = sanitizeText(a.answer_label);
      if (!k) continue;
      drawRow(k, v || "—");
    }

    // Footer (last page)
    curPage.drawText(`Generated: ${new Date().toISOString()}`, { x: M, y: M - 16, size: 8, font, color: rgb(0.5, 0.5, 0.5) });

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="Security-Check-in-3-Minuten_${leadId}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("PDF generation failed:", e);
    const msg = e?.message ? String(e.message) : String(e);
    const stack = e?.stack ? String(e.stack) : "";
    return new Response(JSON.stringify({ ok: false, error: "PDF generation failed", message: msg, stack }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

};
