export type RiskLevel = 'low' | 'medium' | 'high';

export type LeadScore = {
  risk_level: RiskLevel;
  // optional: später ausbauen (points, breakdown, etc.)
  points?: number;
};

type Answer = { question_key: string; answer_value: string | null };

function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

/**
 * Minimal-Scoring: robust gegen fehlende Antworten.
 * Du kannst die Regeln später erweitern, ohne Frontend anfassen zu müssen.
 */
export function computeScores(input: {
  lead?: {
    employee_range?: string | null;
    firewall_vendor?: string | null;
    vpn_technology?: string | null;
    zero_trust_vendor?: string | null;
  };
  answers?: Answer[];
}): LeadScore {
  const answers = input.answers ?? [];
  const lead = input.lead ?? {};

  let points = 0;

  // Heuristiken (konservativ, damit nichts nullt)
  // 1) "unknown"/"dont_know"/leer -> +1 (Risiko/Unklarheit)
  const fields = [
    lead.firewall_vendor,
    lead.vpn_technology,
    lead.zero_trust_vendor,
    lead.employee_range,
  ].map(norm);

  for (const f of fields) {
    if (!f || f === 'unknown' || f === 'dont_know' || f === 'n/a') points += 1;
  }

  // 2) Antworten: bestimmte Keys erhöhen Risiko bei "yes"/kritisch
  for (const a of answers) {
    const key = norm(a.question_key);
    const val = norm(a.answer_value);

    // Beispiel: wenn es Incidents gab -> höheres Risiko
    if (key === 'security_incidents' && (val === 'yes' || val === 'ja')) points += 3;

    // Beispiel: kritische Prozesse auf Website -> etwas höher
    if (key === 'critical_processes_on_website' && (val === 'yes' || val === 'ja')) points += 2;

    // Beispiel: Awareness Training fehlt -> höher
    if (key === 'awareness_training' && (val === 'no' || val === 'nein')) points += 2;
  }

  // Mapping Punkte -> Risk
  let risk_level: RiskLevel = 'medium';
  if (points <= 1) risk_level = 'low';
  else if (points >= 5) risk_level = 'high';

  return { risk_level, points };
}
