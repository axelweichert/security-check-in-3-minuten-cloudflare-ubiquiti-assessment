import { Hono } from "hono";
import { z } from 'zod';
import type { Env } from './core-utils';
import { UserEntity, ChatBoardEntity, LeadEntity, LeadAnswerEntity, LeadScoreEntity } from "./entities";
import { ok, bad, notFound, isStr, Index } from './core-utils';
import type { Lead, LeadScore, SubmitLead, GetLeadResponse } from "@shared/types";
function computeLeadScore(formData: Record<string, any>): Omit<LeadScore, 'lead_id'> {
  const fw = formData.firewall_vendor || 'dont_know';
  const fw_score = { fortinet: 2, palo_alto: 2, check_point: 2, ubiquiti: 2, sophos: 1, watchguard: 1, securepoint: 1, barracuda: 1, opnsense: 1, pfsense: 1, other: 0, dont_know: 0 }[fw] || 0;
  const vpn_tech = formData.vpn_technology || 'dont_know';
  let vpn_score = { wireguard: 2, ipsec: 1, openvpn: 1, sslvpn: 0, l2tp: 0, none: 0, dont_know: 0 }[vpn_tech] || 0;
  const zt = formData.zero_trust_vendor || 'dont_know';
  const zt_score = { cloudflare: 2, other: 1, no: 0, dont_know: 0 }[zt] || 0;
  if (zt === 'cloudflare' && vpn_tech === 'none') {
    // No penalty if Cloudflare ZT is used without a traditional VPN
  }
  const stack_score = fw_score + vpn_score; // ZT is separate
  const total_possible_stack_score = 4; // 2 for firewall + 2 for vpn
  const total_score = Math.round(((stack_score + zt_score) / (total_possible_stack_score + 2)) * 100);
  const risk_level = total_score >= 75 ? 'low' : total_score >= 45 ? 'medium' : 'high';
  const best_practice_architecture = (fw === 'ubiquiti' && zt === 'cloudflare') ? 1 : 0;
  return {
    score_vpn: vpn_score,
    score_web: 0, // Stub
    score_awareness: 0, // Stub
    score_stack: stack_score,
    score_zero_trust: zt_score,
    score_total: total_score,
    risk_level: risk_level,
    best_practice_architecture: best_practice_architecture
  };
}
const submitSchema = z.object({
  language: z.enum(['de', 'en', 'fr']),
  formData: z.record(z.any()).refine(data => {
    return z.string().min(1).safeParse(data.company_name).success &&
           z.string().min(1).safeParse(data.contact_name).success &&
           z.string().min(1).safeParse(data.employee_range).success &&
           z.string().email().safeParse(data.email).success &&
           z.string().min(1).safeParse(data.phone).success &&
           z.enum(['0', '1']).safeParse(data.consent_contact).success;
  }, { message: "Required contact fields are missing or invalid." })
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
      return LeadAnswerEntity.create(c.env, {
        lead_id: leadId,
        question_key,
        answer_value: valueStr,
        score_value: 0 // Score is calculated globally, not per answer here
      });
    });
    await Promise.all(answerPromises);
    const scoresData = computeLeadScore(formData);
    await LeadScoreEntity.create(c.env, { ...scoresData, lead_id: leadId });
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
    // Note: This is a simplified list for the admin panel. Full filtering is complex without a query engine.
    // This implementation will fetch all and filter in memory, which is not suitable for large datasets.
    await LeadEntity.ensureSeed(c.env);
    const { items } = await LeadEntity.list(c.env, null, 1000); // Limit to 1000 for safety
    return ok(c, { items, next: null });
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
  // DEMO ROUTES (can be removed)
  app.get('/api/test', (c) => c.json({ success: true, data: { name: 'CF Workers Demo' }}));
  app.get('/api/users', async (c) => {
    await UserEntity.ensureSeed(c.env);
    const page = await UserEntity.list(c.env);
    return ok(c, page);
  });
  app.get('/api/chats', async (c) => {
    await ChatBoardEntity.ensureSeed(c.env);
    const page = await ChatBoardEntity.list(c.env);
    return ok(c, page);
  });
}