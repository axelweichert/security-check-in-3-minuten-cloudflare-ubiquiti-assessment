export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
// Minimal real-world chat example types (shared by frontend and worker)
export interface User {
  id: string;
  name: string;
}
export interface Chat {
  id: string;
  title: string;
}
export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  text: string;
  ts: number; // epoch millis
}
// Security Check App Types
export interface Lead {
  id: string;
  created_at: string;
  language: string;
  company_name: string;
  contact_name: string;
  employee_range: string;
  email: string;
  phone: string;
  firewall_vendor?: string | null;
  vpn_technology?: string | null;
  zero_trust_vendor?: string | null;
  consent_contact: number;
  consent_tracking: number;
  discount_opt_in: number;
  status: string;
  done_at?: string | null;
}
export interface LeadAnswer {
  lead_id: string;
  question_key: string;
  answer_value: string;
  score_value: number;
}
export interface LeadScore {
  lead_id: string;
  score_vpn: number;
  score_web: number;
  score_awareness: number;
  score_stack: number;
  score_zero_trust: number;
  score_total: number;
  risk_level: 'low' | 'medium' | 'high';
  best_practice_architecture: number;
}
export interface SubmitLead {
  language: 'de' | 'en' | 'fr';
  formData: Record<string, any>;
}
export interface GetLeadResponse {
  lead: Lead;
  answers: LeadAnswer[];
  scores: LeadScore;
}