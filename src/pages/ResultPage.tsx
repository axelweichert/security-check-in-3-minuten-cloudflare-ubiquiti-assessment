import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { api } from '@/lib/api-client';
import type { GetLeadResponse } from '@shared/types';
import { funnelQuestions, techStackQuestions } from '@/lib/questions';
const allQuestions = [...funnelQuestions, ...techStackQuestions];
const riskLevelClasses = {
  low: 'border-green-500/50 bg-green-500/10 text-green-400',
  medium: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
  high: 'border-red-500/50 bg-red-500/10 text-red-400',
};
const ScoreCard = ({ title, score, maxScore }: { title: string, score: number, maxScore: number }) => {
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    let statusText = 'Poor';
    let statusColor = 'text-red-500';
    if (percentage >= 75) {
        statusText = 'Good';
        statusColor = 'text-green-500';
    } else if (percentage >= 40) {
        statusText = 'Medium';
        statusColor = 'text-yellow-500';
    }
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{score}<span className="text-lg text-muted-foreground">/{maxScore}</span></div>
                <p className={`text-sm font-semibold ${statusColor}`}>{statusText}</p>
            </CardContent>
        </Card>
    );
};
export default function ResultPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const { t, i18n } = useTranslation();
  // MOCK DATA FOR DEMO since API is not fully implemented
  const isMock = leadId === 'mock-lead-id';
  const mockData: GetLeadResponse = {
    lead: { id: 'mock-lead-id', created_at: new Date().toISOString(), language: 'de', company_name: 'Musterfirma GmbH', contact_name: 'Max Mustermann', employee_range: '10-49', email: 'test@test.com', phone: '12345', consent_contact: 1, consent_tracking: 0, discount_opt_in: 1, status: 'new' },
    scores: { id: 'mock-lead-id', lead_id: 'mock-lead-id', score_vpn: 1, score_web: 2, score_awareness: 1, score_stack: 2, score_zero_trust: 0, score_total: 55, risk_level: 'medium', best_practice_architecture: 0 },
    answers: [{ id: '1', lead_id: 'mock-lead-id', question_key: 'vpn_in_use', answer_value: 'yes', score_value: 0 }]
  };
  const { data: realData, isLoading, error } = useQuery<GetLeadResponse>({
    queryKey: ['lead', leadId],
    queryFn: () => api(`/api/leads/${leadId}`),
    enabled: !!leadId && !isMock,
  });
  const data = isMock ? mockData : realData;
  useEffect(() => {
    if (data?.lead.language) {
      i18n.changeLanguage(data.lead.language);
    }
  }, [data, i18n]);
  const { riskClasses, answerMap } = useMemo(() => {
    if (!data) return { riskClasses: riskLevelClasses.high, answerMap: new Map() };
    const { scores, answers } = data;
    const riskClasses = riskLevelClasses[scores.risk_level] || riskLevelClasses.high;
    const answerMap = new Map(answers.map(a => [a.question_key, a.answer_value]));
    return { riskClasses, answerMap };
  }, [data]);
  if (isLoading && !isMock) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-grow max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="py-12 space-y-8">
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="space-y-8">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center text-center p-4">
            <div>
                <h2 className="text-2xl font-bold text-destructive">{t('result.error_title', 'Error Loading Results')}</h2>
                <p className="text-muted-foreground mt-2">{error?.message || t('result.error_message', 'The requested lead could not be found.')}</p>
            </div>
        </main>
        <Footer />
      </div>
    );
  }
  const { lead, scores } = data;
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-grow">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-12 space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Card className="shadow-md border-border/60">
                <CardContent className="text-center p-8 md:p-12">
                  <p className="text-base font-medium text-muted-foreground">{t('result.title')}</p>
                  <p className="text-2xl font-semibold mt-1">{lead.company_name}</p>
                  <div className="mt-6 text-7xl md:text-8xl font-black tracking-tighter text-gradient-primary">
                    {scores.score_total}%
                  </div>
                  <Badge variant="outline" className={`mt-4 text-lg font-semibold px-6 py-2 rounded-full border-2 ${riskClasses}`}>
                    {t(`result.risk.${scores.risk_level}`)}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ScoreCard title={t('score.vpn')} score={scores.score_vpn} maxScore={2} />
                <ScoreCard title={t('score.web')} score={scores.score_web} maxScore={3} />
                <ScoreCard title={t('score.awareness')} score={scores.score_awareness} maxScore={2} />
            </div>
            {lead.discount_opt_in === 1 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                <div className="p-4 text-center bg-primary/10 text-primary rounded-lg border border-primary/20">
                  <p className="font-semibold">{t('result.discount_msg')}</p>
                </div>
              </motion.div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="shadow-md">
                    <CardHeader><CardTitle>{t('result.next_steps', 'Next Steps')}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Button asChild size="lg" className="w-full btn-cyber">
                            <a href={`/api/leads/${leadId}/pdf`} download={`Security-Check-in-3-Minuten_${leadId}.pdf`}>
                                {t('result.pdf_btn')}
                            </a>
                        </Button>
                        <Button asChild size="lg" variant="outline" className="w-full">
                            <a href="https://outlook.office.com/book/vonBuschGmbHCloudflare@vonbusch.digital/?ismsaljsauthenabled=true" target="_blank" rel="noopener noreferrer">
                            {t('result.book_btn')}
                            </a>
                        </Button>
                    </CardContent>
                </Card>
                <Card className="shadow-md">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="answers">
                            <AccordionTrigger className="px-6 text-lg font-semibold">{t('result.answers_title', 'Detailed Answers')}</AccordionTrigger>
                            <AccordionContent className="px-6 pt-2">
                            <div className="space-y-2 text-sm">
                                {allQuestions.map(q => {
                                const answer = answerMap.get(q.id);
                                if (!answer) return null;
                                return (
                                    <div key={q.id} className="flex justify-between items-start p-2 rounded-md">
                                    <span className="font-medium text-muted-foreground mr-4">{t(q.labelKey)}:</span>
                                    <span className="text-right font-semibold">{answer}</span>
                                    </div>
                                );
                                })}
                            </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}