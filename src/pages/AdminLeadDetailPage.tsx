import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import type { GetLeadResponse, LeadAnswer } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AtSign, Building, Phone, User, CheckCircle, XCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { allQuestions } from '@/lib/questions';
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

const riskLevelColors: Record<string, string> = {
  low: 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20',
  medium: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20',
  high: 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20',
};

const getDisplayValue = (questionId: string, value: any, t: (key: string) => string): string => {
  const v = (value ?? '').toString();
  const question = allQuestions.find(q => q.id === questionId);
  if (!question || v === '') return v || 'N/A';

  if (question.type === 'checkbox') {
    const values = v.split(', ');
    return values.map(x => {
      const opt = question.options?.find(o => o.value === x);
      return opt ? t(opt.labelKey) : x;
    }).join(', ');
  }

  const opt = question.options?.find(o => o.value === v);
  return opt ? t(opt.labelKey) : v;
};

const answerGroups = {
  vpn: ['vpn_in_use', 'vpn_solution', 'vpn_users', 'vpn_technology', 'remote_access_satisfaction'],
  web: ['critical_processes_on_website', 'hosting_type', 'web_protection', 'security_incidents'],
  awareness: ['awareness_training', 'infrastructure_resilience', 'financial_damage_risk'],
};

const getAnswerGroup = (questionKey: string) => {
  if (answerGroups.vpn.includes(questionKey)) return 'vpn';
  if (answerGroups.web.includes(questionKey)) return 'web';
  if (answerGroups.awareness.includes(questionKey)) return 'awareness';
  return 'other';
};

const InfoItem = ({ icon: Icon, label, children }: { icon: React.ElementType, label: string, children: React.ReactNode }) => (
  <div className="flex items-start space-x-3">
    <Icon className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0" />
    <div className="flex flex-col">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">{children}</span>
    </div>
  </div>
);

const AnswerGroupCard = ({ title, answers, t }: { title: string, answers: LeadAnswer[], t: (key: string) => string }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <dl className="space-y-4">
          {answers.map(answer => {
            const question = allQuestions.find(q => q.id === answer.question_key);
            return (
              <div key={answer.id} className="flex flex-col">
                <dt className="text-sm font-medium text-muted-foreground">{t(question?.labelKey ?? answer.question_key)}</dt>
                <dd className="text-base font-semibold">{getDisplayValue(answer.question_key, answer.answer_value, t)}</dd>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  </motion.div>
);

export default function AdminLeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<GetLeadResponse>({
    queryKey: ['lead', leadId],
    queryFn: () => api(`/api/leads/${leadId}`),
    enabled: !!leadId,
  });

  // API kann (je nach Wrapper) direkt payload liefern. Wir normalisieren defensiv.
  const payload: any = data as any;
  const lead = payload?.lead ?? payload?.item?.lead;
  const answers = payload?.answers ?? payload?.item?.answers ?? [];
  const scores = payload?.scores ?? payload?.item?.scores ?? null;

  useEffect(() => {
    if (lead?.language) i18n.changeLanguage(lead.language);
  }, [lead?.language, i18n]);

  const mutation = useMutation({
    mutationFn: (newStatus: 'new' | 'done') =>
      api(`/api/leads/${leadId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: () => {
      toast.success('Status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => {
      toast.error(`Failed to update status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  const groupedAnswers = useMemo(() => {
    if (!answers || answers.length === 0) return {};
    return answers.reduce((acc: Record<string, LeadAnswer[]>, a: LeadAnswer) => {
      const group = getAnswerGroup(a.question_key);
      (acc[group] ||= []).push(a);
      return acc;
    }, {});
  }, [answers]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !lead) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return (
      <div className="text-destructive text-center p-8 space-y-2">
        <div>Error loading lead details.</div>
        <div className="text-xs opacity-80 break-all">{msg}</div>
      </div>
    );
  }

  const lang = lead.language ?? 'de';
  const riskLevel = scores?.risk_level ?? 'medium';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-8">
      <Button asChild variant="ghost" className="-ml-4">
        <Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> {t('admin.detail.back')}</Link>
      </Button>

      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">{lead.company_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {new Date(lead.created_at).toLocaleDateString(lang, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className={`text-base px-4 py-2 rounded-md border-2 ${riskLevelColors[riskLevel]}`}>
              {t(`result.risk.${riskLevel}`)}
            </Badge>
            <div className="flex items-center space-x-2 p-2 rounded-md bg-secondary">
              <Switch
                id="status-switch"
                checked={lead.status === 'done'}
                onCheckedChange={(checked) => mutation.mutate(checked ? 'done' : 'new')}
                disabled={mutation.isPending}
              />
              <Label htmlFor="status-switch" className="font-semibold">
                {lead.status === 'done' ? t('admin.filters.status.done') : t('admin.filters.status.new')}
              </Label>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          {groupedAnswers['vpn'] && <AnswerGroupCard title={t('score.vpn_title')} answers={groupedAnswers['vpn']} t={t} />}
          {groupedAnswers['web'] && <AnswerGroupCard title={t('score.web_title')} answers={groupedAnswers['web']} t={t} />}
          {groupedAnswers['awareness'] && <AnswerGroupCard title={t('score.awareness_title')} answers={groupedAnswers['awareness']} t={t} />}
        </div>

        <div className="space-y-8 lg:sticky lg:top-24">
          <Card className="shadow-md">
            <CardHeader><CardTitle>{t('admin.table.contact')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <InfoItem icon={User} label={t('contact.contact_person')}>{lead.contact_name}</InfoItem>
              <InfoItem icon={AtSign} label={t('contact.email')}>
                <a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a>
              </InfoItem>
              <InfoItem icon={Phone} label={t('contact.phone')}>
                <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a>
              </InfoItem>
              <InfoItem icon={Building} label={t('contact.employee_count')}>
                {getDisplayValue('employee_range', lead.employee_range, t)}
              </InfoItem>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader><CardTitle>{t('score.stack')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p><strong>{t('q.firewall_vendor')}:</strong> <Badge variant="secondary">{getDisplayValue('firewall_vendor', lead.firewall_vendor || 'unknown', t)}</Badge></p>
              <p><strong>{t('q.vpn_technology')}:</strong> <Badge variant="secondary">{getDisplayValue('vpn_technology', lead.vpn_technology || 'unknown', t)}</Badge></p>
              <p><strong>{t('q.zero_trust_vendor')}:</strong> <Badge variant="secondary">{getDisplayValue('zero_trust_vendor', lead.zero_trust_vendor || 'unknown', t)}</Badge></p>

              <div className="border-t pt-3 mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  {lead.consent_contact ? <CheckCircle className="text-green-500" size={16} /> : <XCircle className="text-muted-foreground" size={16} />}
                  <span>{t('consent.contact')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {lead.consent_tracking ? <CheckCircle className="text-green-500" size={16} /> : <XCircle className="text-muted-foreground" size={16} />}
                  <span>{t('consent.tracking')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {lead.discount_opt_in ? <CheckCircle className="text-green-500" size={16} /> : <XCircle className="text-muted-foreground" size={16} />}
                  <span>{t('consent.discount')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
