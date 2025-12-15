import { Hono } from "hono";
import { z } from 'zod';
import type { Env } from './core-utils';
import { LeadEntity, LeadAnswerEntity, LeadScoreEntity } from "./entities";
import { ok, bad, notFound, Index } from './core-utils';
import type { Lead, LeadScore, SubmitLead, GetLeadResponse, LeadAnswer } from "@shared/types";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// --- Scoring Logic ---
const fwScores: Record<string, number> = { fortinet: 2, palo_alto: 2, check_point: 2, ubiquiti: 2, sophos: 1, watchguard: 1, securepoint: 1, barracuda: 1, opnsense: 1, pfsense: 1, other: 0, dont_know: 0 };
const vpnScores: Record<string, number> = { wireguard: 2, ipsec: 1, openvpn: 1, sslvpn: 0, l2tp: 0, none: 0, dont_know: 0 };
const ztScores: Record<string, number> = { cloudflare: 2, other: 1, no: 0, dont_know: 0 };
const awarenessScores: Record<string, number> = { yes: 2, partially: 1, no: 0 };
function computeLeadScore(formData: Record<string, any>): Omit<LeadScore, 'id' | 'lead_id'> {
  // Awareness Score (max 2)
  const awareness = formData.awareness_training || 'no';
  const score_awareness = awarenessScores[awareness as string] ?? 0;
  // Web Score (max 3)
  let score_web = 0;
  if (formData.web_protection && Array.isArray(formData.web_protection) && !formData.web_protection.includes('none')) {
    score_web += formData.web_protection.length;
  }
  if (formData.hosting_type && formData.hosting_type !== 'on_premise') score_web++;
  if (formData.security_incidents === 'no') score_web++;
  score_web = Math.min(score_web, 3);
  // VPN Score (max 2)
  const zt = formData.zero_trust_vendor || 'dont_know';
  let score_vpn = 0;
  if (formData.vpn_in_use === 'yes') {
    const vpn_tech = formData.vpn_technology || 'dont_know';
    score_vpn = vpnScores[vpn_tech as string] ?? 0;
  } else if (zt !== 'cloudflare') {
    score_vpn = 0; // Penalized if no VPN and no Cloudflare ZT
  }
  // Stack Score (Firewall only, max 2)
  const fw = formData.firewall_vendor || 'dont_know';
  const score_stack = fwScores[fw as string] ?? 0;
  // Zero Trust Score (max 2)
  const score_zero_trust = ztScores[zt as string] ?? 0;
  // Total Score (max possible is 11: awareness 2, web 3, vpn 2, stack 2, zt 2)
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
    consent_contact: z.enum(['0', '1']),
    consent_tracking: z.enum(['0', '1']).optional(),
    discount_opt_in: z.enum(['0', '1']).optional(),
    firewall_vendor: z.string().optional(),
    vpn_technology: z.string().optional(),
    zero_trust_vendor: z.string().optional(),
  }).catchall(z.any())
});
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // LEAD ROUTES
  app.post('/api/leads', async (c) => {
    const body: SubmitLead = await c.req.json();
    const result = submitSchema.safeParse(body);
    if (!result.success) {
      return bad(c, result.error.flatten().fieldErrors.formData?.[0] || 'Invalid submission data');
    }
    const { language, formData } = result.data;
    const leadId = crypto.randomUUID();
    const leadData: Omit<Lead, 'id'> = {
      created_at: new Date().toISOString(),
      language: language,
      company_name: formData.company_name,
      contact_name: formData.contact_name,
      employee_range: formData.employee_range,
      email: formData.email,
      phone: formData.phone,
      firewall_vendor: formData.firewall_vendor || null,
      vpn_technology: formData.vpn_technology || null,
      zero_trust_vendor: formData.zero_trust_vendor || null,
      consent_contact: parseInt(formData.consent_contact),
      consent_tracking: parseInt(formData.consent_tracking || '0'),
      discount_opt_in: parseInt(formData.discount_opt_in || '0'),
      status: 'new'
    };
    const lead = await LeadEntity.create(c.env, { ...leadData, id: leadId });
    const answerPromises = Object.entries(formData).map(([question_key, answer_value]) => {
      const valueStr = Array.isArray(answer_value) ? JSON.stringify(answer_value) : String(answer_value);
      const answerId = `${leadId}_${question_key}`;
      return LeadAnswerEntity.create(c.env, {
        id: answerId,
        lead_id: leadId,
        question_key,
        answer_value: valueStr,
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
    const scoreEntity = new LeadScoreEntity(c.env, leadId);
    const scores = await scoreEntity.getState();
    const answerIndex = new Index<string>(c.env, 'lead_answers');
    const allAnswerKeys = await answerIndex.list();
    const leadAnswerKeys = allAnswerKeys.filter(key => key.startsWith(leadId + '_'));
    const answers = await Promise.all(
      leadAnswerKeys.map(key => new LeadAnswerEntity(c.env, key).getState())
    );
    return ok(c, { lead, scores, answers } as GetLeadResponse);
  });
  app.get('/api/leads', async (c) => {
    await LeadEntity.ensureSeed(c.env);
    const { items } = await LeadEntity.list(c.env, null, 1000); // Limit for safety
    let filteredItems = items;
    // Filtering logic here (simplified for brevity, can be expanded)
    const from = c.req.query('from');
    if (from) filteredItems = filteredItems.filter(l => l.created_at >= from);
    const to = c.req.query('to');
    if (to) filteredItems = filteredItems.filter(l => l.created_at <= to);
    const status = c.req.query('status');
    if (status) filteredItems = filteredItems.filter(l => l.status === status);
    const discount = c.req.query('discount');
    if (discount) filteredItems = filteredItems.filter(l => l.discount_opt_in === (discount === 'true' ? 1 : 0));
    const risk = c.req.query('risk');
    if (risk) {
        const scores = await Promise.all(filteredItems.map(l => new LeadScoreEntity(c.env, l.id).getState()));
        const leadIdToRisk = new Map(scores.map(s => [s.lead_id, s.risk_level]));
        filteredItems = filteredItems.filter(l => leadIdToRisk.get(l.id) === risk);
    }
    return ok(c, { items: filteredItems.slice(0, 100), next: null });
  });
  app.post('/api/leads/:leadId/status', async (c) => {
    const leadId = c.req.param('leadId');
    const { status } = await c.req.json<{ status?: string }>();
    if (!status || !['new', 'done'].includes(status)) return bad(c, 'Invalid status');
    const leadE = new LeadEntity(c.env, leadId);
    if (!await leadE.exists()) return notFound(c);
    const patchData: Partial<Lead> = { status };
    if (status === 'done') {
      patchData.done_at = new Date().toISOString();
    } else {
      patchData.done_at = null;
    }
    await leadE.patch(patchData);
    return ok(c, { success: true });
  });
  app.get('/api/leads/export.csv', async (c) => {
    // Simplified version of filtering from GET /api/leads
    const { items } = await LeadEntity.list(c.env, null, 1000);
    const knownQuestions = ['vpn_in_use', 'critical_processes_on_website', 'awareness_training', 'vpn_solution', 'vpn_users', 'hosting_type', 'web_protection', 'security_incidents', 'remote_access_satisfaction', 'infrastructure_resilience', 'financial_damage_risk', 'firewall_vendor', 'vpn_technology', 'zero_trust_vendor', 'consent_contact', 'consent_tracking', 'discount_opt_in'];
    const headers = ['id', 'created_at', 'risk_level', 'company_name', 'contact_name', 'employee_range', 'email', 'phone', ...knownQuestions];
    let csv = headers.join(';') + '\n';
    for (const lead of items) {
        const score = await new LeadScoreEntity(c.env, lead.id).getState();
        const answerIndex = new Index<string>(c.env, 'lead_answers');
        const allAnswerKeys = await answerIndex.list();
        const leadAnswerKeys = allAnswerKeys.filter(key => key.startsWith(lead.id + '_'));
        const answers = await Promise.all(leadAnswerKeys.map(key => new LeadAnswerEntity(c.env, key).getState()));
        const answerMap = new Map(answers.map(a => [a.question_key, a.answer_value]));
        const row = headers.map(h => {
            if (h === 'risk_level') return score.risk_level;
            if (knownQuestions.includes(h)) return answerMap.get(h) || '';
            return lead[h as keyof Lead] || '';
        });
        csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\n';
    }
    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="leads_export.csv"'
        }
    });
  });
  app.get('/api/leads/:id/pdf', async (c) => {
    const leadId = c.req.param('id');
    const leadData = await new LeadEntity(c.env, leadId).getState();
    const scoreData = await new LeadScoreEntity(c.env, leadId).getState();
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    // Simple header
    page.drawText('Security Check - Auswertung', { x: 50, y: height - 50, font: boldFont, size: 24 });
    page.drawText(`Für: ${leadData.company_name}`, { x: 50, y: height - 80, font, size: 12 });
    // Risk Level
    page.drawText('Risikolevel:', { x: 50, y: height - 120, font: boldFont, size: 18 });
    page.drawText(scoreData.risk_level.toUpperCase(), { x: 150, y: height - 120, font: boldFont, size: 18, color: scoreData.risk_level === 'high' ? rgb(0.9, 0, 0) : scoreData.risk_level === 'medium' ? rgb(0.9, 0.6, 0) : rgb(0, 0.6, 0) });
    // Scores
    let yPos = height - 160;
    page.drawText('Scores:', { x: 50, y: yPos, font: boldFont, size: 14 });
    yPos -= 20;
    const scores = [
        { label: 'VPN', value: scoreData.score_vpn },
        { label: 'Web', value: scoreData.score_web },
        { label: 'Awareness', value: scoreData.score_awareness },
        { label: 'Tech Stack', value: scoreData.score_stack },
        { label: 'Zero Trust', value: scoreData.score_zero_trust },
        { label: 'Total', value: scoreData.score_total, isTotal: true },
    ];
    for (const score of scores) {
        page.drawText(`${score.label}: ${score.value}${score.isTotal ? '%' : ''}`, { x: 60, y: yPos, font, size: 12 });
        yPos -= 20;
    }
    // Footer
    page.drawText('von Busch GmbH | Cloudflare | Ubiquiti', { x: 50, y: 50, font, size: 10, color: rgb(0.5, 0.5, 0.5) });
    const pdfBytes = await doc.save();
    return new Response(pdfBytes, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Security-Check_${leadId}.pdf"`
        }
    });
  });
}