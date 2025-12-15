/**
 * Minimal real-world demo: One Durable Object instance per entity (User, ChatBoard), with Indexes for listing.
 */
import { IndexedEntity } from "./core-utils";
import type { User, Chat, ChatMessage, Lead, LeadAnswer, LeadScore } from "@shared/types";
import { MOCK_CHAT_MESSAGES, MOCK_CHATS, MOCK_USERS } from "@shared/mock-data";
// USER ENTITY: one DO instance per user
export class UserEntity extends IndexedEntity<User> {
  static readonly entityName = "user";
  static readonly indexName = "users";
  static readonly initialState: User = { id: "", name: "" };
  static seedData = MOCK_USERS;
}
// CHAT BOARD ENTITY: one DO instance per chat board, stores its own messages
export type ChatBoardState = Chat & { messages: ChatMessage[] };
const SEED_CHAT_BOARDS: ChatBoardState[] = MOCK_CHATS.map(c => ({
  ...c,
  messages: MOCK_CHAT_MESSAGES.filter(m => m.chatId === c.id),
}));
export class ChatBoardEntity extends IndexedEntity<ChatBoardState> {
  static readonly entityName = "chat";
  static readonly indexName = "chats";
  static readonly initialState: ChatBoardState = { id: "", title: "", messages: [] };
  static seedData = SEED_CHAT_BOARDS;
  async listMessages(): Promise<ChatMessage[]> {
    const { messages } = await this.getState();
    return messages;
  }
  async sendMessage(userId: string, text: string): Promise<ChatMessage> {
    const msg: ChatMessage = { id: crypto.randomUUID(), chatId: this.id, userId, text, ts: Date.now() };
    await this.mutate(s => ({ ...s, messages: [...s.messages, msg] }));
    return msg;
  }
}
// SECURITY CHECK ENTITIES
export class LeadEntity extends IndexedEntity<Lead> {
  static readonly entityName = "lead";
  static readonly indexName = "leads";
  static readonly initialState: Lead = { 
    id: "", 
    created_at: "", 
    language: "de", 
    company_name: "", 
    contact_name: "", 
    employee_range: "", 
    email: "", 
    phone: "", 
    consent_contact: 0, 
    consent_tracking: 0, 
    discount_opt_in: 0, 
    status: "new" 
  };
  static seedData: Lead[] = [];
}
export class LeadAnswerEntity extends IndexedEntity<LeadAnswer> {
  static readonly entityName = "lead_answer";
  static readonly indexName = "lead_answers";
  static keyOf(state: LeadAnswer): string { return `${state.lead_id}_${state.question_key}`; }
  static readonly initialState: LeadAnswer = { 
    lead_id: "", 
    question_key: "", 
    answer_value: "", 
    score_value: 0 
  };
  static seedData: LeadAnswer[] = [];
}
export class LeadScoreEntity extends IndexedEntity<LeadScore> {
  static readonly entityName = "lead_score";
  static readonly indexName = "lead_scores";
  static keyOf(state: LeadScore): string { return state.lead_id; }
  static readonly initialState: LeadScore = { 
    lead_id: "", 
    score_vpn: 0, 
    score_web: 0, 
    score_awareness: 0, 
    score_stack: 0, 
    score_zero_trust: 0, 
    score_total: 0, 
    risk_level: "high" as const, 
    best_practice_architecture: 0 
  };
  static seedData: LeadScore[] = [];
}