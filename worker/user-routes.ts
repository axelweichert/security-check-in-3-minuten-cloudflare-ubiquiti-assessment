import { Hono } from "hono";
import { z } from 'zod';
import type { Env } from './core-utils';
import { LeadEntity, LeadAnswerEntity, LeadScoreEntity } from "./entities";
import { ok, bad, notFound, Index } from './core-utils';
import type { Lead, LeadScore, SubmitLead, GetLeadResponse, LeadAnswer, LeadListItem } from "@shared/types";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// --- Scoring Logic ---
const fwScores: Record<string, number> = { fortinet: 2, palo_alto: 2, check_point: 2, ubiquiti: 2, sophos: 1, watchguard: 1, securepoint: 1, barracuda: 1, opnsense: 1, pfsense: 1, other: 0, dont_know: 0 };
const vpnScores: Record<string, number> = { wireguard: 2, ipsec: 1, openvpn: 1, sslvpn: 0, l2tp: 0, none: 0, dont_know: 0 };
const ztScores: Record<string, number> = { cloudflare: 2, other: 1, no: 0, dont_know: 0 };
const awarenessScores: Record<string, number> = { yes: 2, partially: 1, no: 0 };
function computeLeadScore(formData: Record<string, any>): Omit<LeadScore, 'id' | 'lead_id'> {
  const awareness = formData.awareness_training || 'no';
  const score_awareness = awarenessScores[awareness as string] ?? 0;
  let score_web = 0;
  if (formData.web_protection && Array.isArray(formData.web_protection) && !formData.web_protection.includes('none')) {
    score_web += formData.web_protection.length;
  }
  if (formData.hosting_type && formData.hosting_type !== 'on_premise') score_web++;
  if (formData.security_incidents === 'no') score_web++;
  score_web = Math.min(score_web, 3);
  const zt = formData.zero_trust_vendor || 'dont_know';
  let score_vpn = 0;
  if (formData.vpn_in_use === 'yes') {
    const vpn_tech = formData.vpn_technology || 'dont_know';
    score_vpn = vpnScores[vpn_tech as string] ?? 0;
  } else if (zt !== 'cloudflare') {
    score_vpn = 0;
  } else {
    score_vpn = 2; // No penalty if no VPN but has Cloudflare ZT
  }
  const fw = formData.firewall_vendor || 'dont_know';
  const score_stack = fwScores[fw as string] ?? 0;
  const score_zero_trust = ztScores[zt as string] ?? 0;
  const totalAchieved = score_awareness + score_web + score_vpn + score_stack + score_zero_trust;
  const totalPossible = 11;
  const score_total = Math.round((totalAchieved / totalPossible) * 100);
  const risk_level = score_total >= 75 ? 'low' : score_total >= 45 ? 'medium' : 'high';
  const best_practice_architecture = (fw === 'ubiquiti' && zt === 'cloudflare') ? 1 : 0;
  return {
    score_vpn,
    score_web,
    score_awareness,
    score_stack,
    score_zero_trust,
    score_total,
    risk_level,
    best_practice_architecture
  };
}
const submitSchema = z.object({
  language: z.enum(['de', 'en', 'fr']),
  formData: z.object({
    company_name: z.string().min(1),
    contact_name: z.string().min(1),
    employee_range: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    consent_contact: z.number().min(0).max(1),
  }).catchall(z.any())
});
const pdfTexts = {
  de: { header: 'Ihre Security-Auswertung', title: 'Auswertung für', risk: 'Risikolevel', risk_low: 'Niedriges Risiko', risk_medium: 'Mittleres Risiko', risk_high: 'Hohes Risiko', scores_title: 'Score-Übersicht', answers_title: 'Ihre Antworten', vpn: 'VPN', web: 'Web-Schutz', awareness: 'Awareness', stack: 'Tech Stack', zero_trust: 'Zero Trust', total: 'Gesamt', discount: '500€ Rabatt für Cloudflare Zero Trust Implementierung reserviert.', booking: 'Buchen Sie Ihren Beratungstermin:' },
  en: { header: 'Your Security Evaluation', title: 'Evaluation for', risk: 'Risk Level', risk_low: 'Low Risk', risk_medium: 'Medium Risk', risk_high: 'High Risk', scores_title: 'Score Overview', answers_title: 'Your Answers', vpn: 'VPN', web: 'Web Protection', awareness: 'Awareness', stack: 'Tech Stack', zero_trust: 'Zero Trust', total: 'Total', discount: '€500 discount for Cloudflare Zero Trust implementation reserved.', booking: 'Book your consultation:' },
  fr: { header: 'Votre Évaluation de Sécurité', title: 'Évaluation pour', risk: 'Niveau de Risque', risk_low: 'Risque Faible', risk_medium: 'Risque Moyen', risk_high: 'Risque Élevé', scores_title: 'Aperçu du Score', answers_title: 'Vos Réponses', vpn: 'VPN', web: 'Protection Web', awareness: 'Sensibilisation', stack: 'Stack Tech', zero_trust: 'Zero Trust', total: 'Total', discount: '500€ de réduction réservés pour l\'implémentation de Cloudflare Zero Trust.', booking: 'Réservez votre consultation:' },
};
async function getFilteredLeads(c: any): Promise<LeadListItem[]> {
    const { items: rawLeads } = await LeadEntity.list(c.env, null, 1000);
    const leadsWithScores = await Promise.all(rawLeads.map(async (lead) => {
        const scoreEntity = new LeadScoreEntity(c.env, lead.id);
        const score = await scoreEntity.getState();
        return { ...lead, risk_level: score.risk_level };
    }));
    let filteredItems = leadsWithScores;
    const from = c.req.query('from');
    if (from) filteredItems = filteredItems.filter(l => l.created_at >= from);
    const to = c.req.query('to');
    if (to) filteredItems = filteredItems.filter(l => l.created_at <= to);
    const status = c.req.query('status');
    if (status && status !== 'all') filteredItems = filteredItems.filter(l => l.status === status);
    const discount = c.req.query('discount');
    if (discount && discount !== 'all') filteredItems = filteredItems.filter(l => l.discount_opt_in === (discount === 'yes' ? 1 : 0));
    const risk = c.req.query('risk');
    if (risk && risk !== 'all') filteredItems = filteredItems.filter(l => l.risk_level === risk);
    return filteredItems;
}
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  app.post('/api/leads', async (c) => {
    const body: SubmitLead = await c.req.json();
    const result = submitSchema.safeParse(body);
    if (!result.success) return bad(c, result.error.flatten().fieldErrors.formData?.[0] || 'Invalid submission data');
    const { language, formData } = result.data;
    const leadId = crypto.randomUUID();
    const leadData: Omit<Lead, 'id'> = {
      created_at: new Date().toISOString(), language,
      company_name: formData.company_name, contact_name: formData.contact_name,
      employee_range: formData.employee_range, email: formData.email, phone: formData.phone,
      firewall_vendor: formData.firewall_vendor || null, vpn_technology: formData.vpn_technology || null,
      zero_trust_vendor: formData.zero_trust_vendor || null,
      consent_contact: formData.consent_contact,
      consent_tracking: formData.consent_tracking || 0,
      discount_opt_in: formData.discount_opt_in || 0,
      status: 'new'
    };
    const lead = await LeadEntity.create(c.env, { ...leadData, id: leadId });
    const answerPromises = Object.entries(formData).map(([key, value]) => {
      const answerId = `${leadId}_${key}`;
      return LeadAnswerEntity.create(c.env, {
        id: answerId, lead_id: leadId, question_key: key,
        answer_value: Array.isArray(value) ? value.join(', ') : String(value),
        score_value: 0
      });
    });
    await Promise.all(answerPromises);
    const scoresData = computeLeadScore(formData);
    await LeadScoreEntity.create(c.env, { ...scoresData, id: leadId, lead_id: leadId });
    return ok(c, lead);
  });
  app.get('/api/leads/:leadId', async (c) => {
    const leadId = c.req.param('leadId');
    const leadEntity = new LeadEntity(c.env, leadId);
    if (!await leadEntity.exists()) return notFound(c, 'Lead not found');
    const lead = await leadEntity.getState();
    const scores = await new LeadScoreEntity(c.env, leadId).getState();
    const answerIndex = new Index<string>(c.env, 'lead_answers');
    const { items: allAnswerKeys } = await answerIndex.page(null, 1000);
    const leadAnswerKeys = allAnswerKeys.filter(key => key.startsWith(leadId + '_'));
    const answers = await Promise.all(leadAnswerKeys.map(key => new LeadAnswerEntity(c.env, key).getState()));
    return ok(c, { lead, scores, answers } as GetLeadResponse);
  });
  app.get('/api/leads', async (c) => {
    const items = await getFilteredLeads(c);
    return ok(c, { items: items.slice(0, 100), next: null });
  });
  app.post('/api/leads/:leadId/status', async (c) => {
    const leadId = c.req.param('leadId');
    const { status } = await c.req.json<{ status?: string }>();
    if (!status || !['new', 'done'].includes(status)) return bad(c, 'Invalid status');
    const leadE = new LeadEntity(c.env, leadId);
    if (!await leadE.exists()) return notFound(c);
    const patchData: Partial<Lead> = { status, done_at: status === 'done' ? new Date().toISOString() : null };
    await leadE.patch(patchData);
    return ok(c, { success: true });
  });
  app.get('/api/leads/export.csv', async (c) => {
    const leads = await getFilteredLeads(c);
    const knownQuestions = ['vpn_in_use', 'critical_processes_on_website', 'awareness_training', 'vpn_solution', 'vpn_users', 'hosting_type', 'web_protection', 'security_incidents', 'remote_access_satisfaction', 'infrastructure_resilience', 'financial_damage_risk', 'firewall_vendor', 'vpn_technology', 'zero_trust_vendor', 'consent_contact', 'consent_tracking', 'discount_opt_in'];
    const headers = ['id', 'created_at', 'risk_level', 'company_name', 'contact_name', 'employee_range', 'email', 'phone', ...knownQuestions];
    const rows = await Promise.all(leads.map(async (lead) => {
        const answerIndex = new Index<string>(c.env, 'lead_answers');
        const { items: allKeys } = await answerIndex.page(null, 1000);
        const leadKeys = allKeys.filter(k => k.startsWith(lead.id + '_'));
        const answers = await Promise.all(leadKeys.map(k => new LeadAnswerEntity(c.env, k).getState()));
        const answerMap = new Map(answers.map(a => [a.question_key, a.answer_value]));
        return headers.map(h => {
            if (h === 'risk_level') return lead.risk_level;
            if (knownQuestions.includes(h)) return answerMap.get(h) || '';
            return lead[h as keyof Lead] || '';
        }).map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
    }));
    const csv = [headers.join(';'), ...rows].join('\n');
    return new Response("\uFEFF" + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads_export.csv"' } });
  });
  app.get('/api/leads/:id/pdf', async (c) => {
    const leadId = c.req.param('id');
    const leadData = await new LeadEntity(c.env, leadId).getState();
    const scoreData = await new LeadScoreEntity(c.env, leadId).getState();
    const answerIndex = new Index<string>(c.env, 'lead_answers');
    const { items: allKeys } = await answerIndex.page(null, 1000);
    const leadKeys = allKeys.filter(k => k.startsWith(leadId + '_'));
    const answers = await Promise.all(leadKeys.map(k => new LeadAnswerEntity(c.env, k).getState()));
    const doc = await PDFDocument.create();
    let page = doc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    let currentY = height - 50;
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const texts = pdfTexts[leadData.language as keyof typeof pdfTexts] || pdfTexts.de;
    const riskColors = { low: rgb(0.13, 0.77, 0.35), medium: rgb(0.96, 0.62, 0.04), high: rgb(0.94, 0.27, 0.27) };
    const riskColor = riskColors[scoreData.risk_level];
    page.drawText(texts.header, { x: 50, y: currentY, font: boldFont, size: 24 });
    currentY -= 30;
    page.drawText(`${texts.title} ${leadData.company_name}`, { x: 50, y: currentY, font, size: 12 });
    currentY -= 40;
    page.drawRectangle({ x: 50, y: currentY - 22, width: 150, height: 30, color: riskColor, opacity: 0.1, borderColor: riskColor, borderWidth: 1 });
    page.drawText(`${texts.risk}: ${texts[`risk_${scoreData.risk_level}`]}`, { x: 60, y: currentY-15, font: boldFont, size: 14, color: riskColor });
    currentY -= 60;
    page.drawText(texts.scores_title, { x: 50, y: currentY, font: boldFont, size: 16 });
    currentY -= 25;
    const scores = [
        { name: texts.vpn, value: scoreData.score_vpn, max: 2 },
        { name: texts.web, value: scoreData.score_web, max: 3 },
        { name: texts.awareness, value: scoreData.score_awareness, max: 2 },
        { name: texts.stack, value: scoreData.score_stack, max: 2 },
        { name: texts.zero_trust, value: scoreData.score_zero_trust, max: 2 },
    ];
    for (const score of scores) {
        page.drawText(`${score.name}: ${score.value}/${score.max}`, { x: 60, y: currentY, font, size: 11 });
        page.drawRectangle({ x: 200, y: currentY, width: 300, height: 10, color: rgb(0.9, 0.9, 0.9) });
        page.drawRectangle({ x: 200, y: currentY, width: (score.value / score.max) * 300, height: 10, color: riskColor });
        currentY -= 20;
    }
    currentY -= 20;
    page.drawText(texts.answers_title, { x: 50, y: currentY, font: boldFont, size: 16 });
    currentY -= 25;
    for (const answer of answers) {
        if (currentY < 100) {
            page = doc.addPage();
            currentY = height - 50;
        }
        page.drawText(`${answer.question_key}:`, { x: 60, y: currentY, font: boldFont, size: 10 });
        page.drawText(answer.answer_value, { x: 200, y: currentY, font, size: 10, maxWidth: 350 });
        currentY -= 20;
    }
    if (leadData.discount_opt_in) {
        if (currentY < 100) {
            page = doc.addPage();
            currentY = height - 50;
        }
        page.drawText(texts.discount, { x: 50, y: currentY, font: boldFont, size: 11, color: rgb(0.1, 0.5, 0.1) });
        currentY -= 20;
    }
    if (currentY < 120) {
        page = doc.addPage();
        currentY = height - 50;
    }
    page.drawText('von Busch GmbH | HXNWRK | Cloudflare | Ubiquiti', { x: 50, y: 50, font, size: 9, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(`${texts.booking} https://outlook.office.com/book/vonBuschGmbHCloudflare@vonbusch.digital/`, { x: 50, y: 35, font, size: 9, color: rgb(0.2, 0.4, 0.8) });
    const pdfBytes = await doc.save();
    return new Response(pdfBytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Security-Check-in-3-Minuten_${leadId}.pdf"` } });
  });
}