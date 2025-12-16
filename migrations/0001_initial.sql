CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  language TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  employee_range TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  firewall_vendor TEXT NOT NULL,
  vpn_technology TEXT NOT NULL,
  zero_trust_vendor TEXT NOT NULL,
  consent_contact INTEGER NOT NULL,
  consent_tracking INTEGER NOT NULL,
  discount_opt_in INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  done_at TEXT
);

CREATE TABLE IF NOT EXISTS lead_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  question_key TEXT NOT NULL,
  answer_value TEXT NOT NULL,
  score_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_scores (
  lead_id TEXT PRIMARY KEY,
  score_vpn INTEGER NOT NULL,
  score_web INTEGER NOT NULL,
  score_awareness INTEGER NOT NULL,
  score_stack INTEGER NOT NULL,
  score_zero_trust INTEGER NOT NULL,
  score_total INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  best_practice_architecture INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_discount ON leads(discount_opt_in);
CREATE INDEX IF NOT EXISTS idx_answers_lead_id ON lead_answers(lead_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_key ON lead_answers(question_key);
CREATE INDEX IF NOT EXISTS idx_scores_risk ON lead_scores(risk_level);
