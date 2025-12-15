export type QuestionType = 'radio' | 'select' | 'checkbox' | 'text' | 'email' | 'tel';
export interface QuestionOption {
  value: string;
  labelKey: string;
}
export interface Question {
  id: string;
  level: number;
  type: QuestionType;
  labelKey: string;
  options?: QuestionOption[];
  required?: boolean;
  dependsOn?: {
    questionId: string;
    value: string | string[];
  };
}
export const funnelQuestions: Question[] = [
  // Level 1
  {
    id: 'vpn_in_use',
    level: 1,
    type: 'radio',
    labelKey: 'q.vpn_in_use',
    options: [
      { value: 'yes', labelKey: 'o.yes' },
      { value: 'no', labelKey: 'o.no' },
    ],
    required: true,
  },
  {
    id: 'critical_processes_on_website',
    level: 1,
    type: 'radio',
    labelKey: 'q.critical_processes_on_website',
    options: [
      { value: 'yes', labelKey: 'o.yes' },
      { value: 'no', labelKey: 'o.no' },
    ],
    required: true,
  },
  {
    id: 'awareness_training',
    level: 1,
    type: 'radio',
    labelKey: 'q.awareness_training',
    options: [
      { value: 'yes', labelKey: 'o.yes' },
      { value: 'partially', labelKey: 'o.partially' },
      { value: 'no', labelKey: 'o.no' },
    ],
    required: true,
  },
  // Level 2
  {
    id: 'vpn_solution',
    level: 2,
    type: 'radio',
    labelKey: 'q.vpn_solution',
    options: [
      { value: 'firewall_vpn', labelKey: 'Firewall-integriertes VPN' },
      { value: 'dedicated_vpn', labelKey: 'Dedizierte VPN-Lösung' },
      { value: 'cloud_vpn', labelKey: 'Cloud-basierter VPN-Service' },
      { value: 'dont_know', labelKey: 'o.dont_know' },
    ],
    dependsOn: { questionId: 'vpn_in_use', value: 'yes' },
    required: true,
  },
  {
    id: 'vpn_users',
    level: 2,
    type: 'select',
    labelKey: 'q.vpn_users',
    options: [
      { value: 'less_than_10', labelKey: 'o.less_than_10' },
      { value: '10_to_50', labelKey: 'o.10_to_50' },
      { value: '51_to_200', labelKey: 'o.51_to_200' },
      { value: 'more_than_200', labelKey: 'o.more_than_200' },
    ],
    dependsOn: { questionId: 'vpn_in_use', value: 'yes' },
    required: true,
  },
  {
    id: 'hosting_type',
    level: 2,
    type: 'select',
    labelKey: 'q.hosting_type',
    options: [
      { value: 'on_premise', labelKey: 'o.on_premise' },
      { value: 'cloud_hosting', labelKey: 'o.cloud_hosting' },
      { value: 'managed_hosting', labelKey: 'o.managed_hosting' },
      { value: 'dont_know', labelKey: 'o.dont_know' },
    ],
    required: true,
  },
  {
    id: 'web_protection',
    level: 2,
    type: 'checkbox',
    labelKey: 'q.web_protection',
    options: [
      { value: 'waf', labelKey: 'o.waf' },
      { value: 'ddos_protection', labelKey: 'o.ddos_protection' },
      { value: 'cdn', labelKey: 'o.cdn' },
      { value: 'none', labelKey: 'o.none' },
    ],
    required: true,
  },
  {
    id: 'security_incidents',
    level: 2,
    type: 'radio',
    labelKey: 'q.security_incidents',
    options: [
      { value: 'yes', labelKey: 'o.yes' },
      { value: 'no', labelKey: 'o.no' },
      { value: 'dont_know', labelKey: 'o.dont_know' },
    ],
    required: true,
  },
  // Level 3
  {
    id: 'remote_access_satisfaction',
    level: 3,
    type: 'radio',
    labelKey: 'q.remote_access_satisfaction',
    options: [
      { value: 'very_satisfied', labelKey: 'o.very_satisfied' },
      { value: 'satisfied', labelKey: 'o.satisfied' },
      { value: 'neutral', labelKey: 'o.neutral' },
      { value: 'unsatisfied', labelKey: 'o.unsatisfied' },
      { value: 'very_unsatisfied', labelKey: 'o.very_unsatisfied' },
    ],
    dependsOn: { questionId: 'vpn_in_use', value: 'yes' },
    required: true,
  },
  {
    id: 'infrastructure_resilience',
    level: 3,
    type: 'select',
    labelKey: 'q.infrastructure_resilience',
    options: [
      { value: 'very_high', labelKey: 'o.very_high' },
      { value: 'high', labelKey: 'o.high' },
      { value: 'medium', labelKey: 'o.medium' },
      { value: 'low', labelKey: 'o.low' },
      { value: 'very_low', labelKey: 'o.very_low' },
    ],
    required: true,
  },
  {
    id: 'financial_damage_risk',
    level: 3,
    type: 'select',
    labelKey: 'q.financial_damage_risk',
    options: [
      { value: 'less_than_5k', labelKey: 'o.less_than_5k' },
      { value: '5k_to_25k', labelKey: 'o.5k_to_25k' },
      { value: '25k_to_100k', labelKey: 'o.25k_to_100k' },
      { value: 'more_than_100k', labelKey: 'o.more_than_100k' },
    ],
    required: true,
  },
];
export const techStackQuestions: Question[] = [
  {
    id: 'firewall_vendor',
    level: 4,
    type: 'select',
    labelKey: 'q.firewall_vendor',
    options: [
      { value: 'fortinet', labelKey: 'Fortinet' },
      { value: 'palo_alto', labelKey: 'Palo Alto' },
      { value: 'check_point', labelKey: 'Check Point' },
      { value: 'ubiquiti', labelKey: 'Ubiquiti' },
      { value: 'sophos', labelKey: 'Sophos' },
      { value: 'watchguard', labelKey: 'WatchGuard' },
      { value: 'securepoint', labelKey: 'Securepoint' },
      { value: 'barracuda', labelKey: 'Barracuda' },
      { value: 'opnsense', labelKey: 'OPNsense' },
      { value: 'pfsense', labelKey: 'pfSense' },
      { value: 'other', labelKey: 'Sonstige' },
      { value: 'dont_know', labelKey: 'o.dont_know' },
    ],
    required: true,
  },
  {
    id: 'vpn_technology',
    level: 4,
    type: 'select',
    labelKey: 'q.vpn_technology',
    options: [
      { value: 'ipsec', labelKey: 'IPsec' },
      { value: 'openvpn', labelKey: 'OpenVPN' },
      { value: 'wireguard', labelKey: 'WireGuard' },
      { value: 'sslvpn', labelKey: 'SSL-VPN' },
      { value: 'l2tp', labelKey: 'L2TP' },
      { value: 'none', labelKey: 'o.no_vpn' },
      { value: 'dont_know', labelKey: 'o.dont_know' },
    ],
    required: true,
  },
  {
    id: 'zero_trust_vendor',
    level: 4,
    type: 'select',
    labelKey: 'q.zero_trust_vendor',
    options: [
      { value: 'cloudflare', labelKey: 'Cloudflare Zero Trust' },
      { value: 'other', labelKey: 'Andere Zero-Trust-Lösung' },
      { value: 'no', labelKey: 'Nein' },
      { value: 'dont_know', labelKey: 'o.dont_know' },
    ],
    required: true,
  },
];
export const contactQuestions: Question[] = [
    { id: 'company_name', level: 5, type: 'text', labelKey: 'contact.company_name', required: true },
    { id: 'contact_name', level: 5, type: 'text', labelKey: 'contact.contact_person', required: true },
    { id: 'employee_range', level: 5, type: 'select', labelKey: 'contact.employee_count', required: true, options: [
        { value: '1-9', labelKey: '1-9' },
        { value: '10-49', labelKey: '10-49' },
        { value: '50-249', labelKey: '50-249' },
        { value: '250+', labelKey: '250+' },
    ]},
    { id: 'email', level: 5, type: 'email', labelKey: 'contact.email', required: true },
    { id: 'phone', level: 5, type: 'tel', labelKey: 'contact.phone', required: true },
];
export const TOTAL_STEPS = 5;