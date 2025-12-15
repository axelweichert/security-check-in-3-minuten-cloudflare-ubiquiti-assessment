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
import { funnelQuestions, techStackQuestions, contactQuestions } from '@/lib/questions';
import { toast } from 'sonner';
const allQuestions = [...funnelQuestions, ...techStackQuestions, ...contactQuestions];
const riskLevelClasses = {
  low: 'border-green-500/50 bg-green-500/10 text-green-400',
  medium: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
  high: 'border-red-500/50 bg-red-500/10 text-red-400',
};
type ScoreStatus = 'poor' | 'medium' | 'good';
const getScoreStatus = (score: number, maxScore: number): ScoreStatus => {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (percentage >= 75) return 'good';
  if (percentage >= 40) return 'medium';
  return 'poor';
};
const ScoreBreakdownCard = ({ title, status, explanation }: { title: string, status: ScoreStatus, explanation: string }) => {
  const { t } = useTranslation();
  const statusColors: Record<ScoreStatus, string> = {
    poor: 'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    good: 'bg-green-500/10 text-green-400 border-green-500/20',
  };
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          <Badge variant="outline" className={`font-bold ${statusColors[status]}`}>{t(`score.status.${status}`)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{explanation}</p>
      </CardContent>
    </Card>
  );
};
export default function ResultPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const { t, i18n } = useTranslation();
  const { data, isLoading, error } = useQuery<GetLeadResponse>({
    queryKey: ['lead', leadId],
    queryFn: () => api(`/api/leads/${leadId}`),
    enabled: !!leadId,
  });
  useEffect(() => {
    if (data?.lead.language) {
      i18n.changeLanguage(data.lead.language);
    }
  }, [data, i18n]);
  const handlePdfDownload = async () => {
    if (!leadId) return;
    const toastId = toast.loading(t('pdf.loading'));
    try {
      const response = await fetch(`/api/leads/${leadId}/pdf`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) {
        throw new Error('PDF generation failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Security-Check-in-3-Minuten_${leadId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.dismiss(toastId);
    } catch (err) {
      console.error('PDF download error:', err);
      toast.error(t('pdf.error'), { id: toastId });
    }
  };
  const getDisplayValue = (questionId: string, value: string): string => {
    const question = allQuestions.find(q => q.id === questionId);
    if (!question || value === null || value === undefined) return value || 'N/A';
    if (question.type === 'checkbox') {
      const values = value.split(', ');
      return values.map(v => {
        const option = question.options?.find(o => o.value === v);
        return option ? t(option.labelKey) : v;
      }).join(', ');
    }
    const option = question.options?.find(o => o.value === value);
    return option ? t(option.labelKey) : value;
  };
  const { riskClasses, answerMap } = useMemo(() => {
    if (!data) return { riskClasses: riskLevelClasses.high, answerMap: new Map() };
    const { scores, answers } = data;
    const riskClasses = riskLevelClasses[scores.risk_level] || riskLevelClasses.high;
    const answerMap = new Map(answers.map(a => [a.question_key, a.answer_value]));
    return { riskClasses, answerMap };
  }, [data]);
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="py-8 md:py-10 lg:py-12 space-y-8">
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
  const vpnStatus = getScoreStatus(scores.score_vpn, 2);
  const webStatus = getScoreStatus(scores.score_web, 3);
  const awarenessStatus = getScoreStatus(scores.score_awareness, 2);
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8 md:py-10 lg:py-12 space-y-8">
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
                <ScoreBreakdownCard title={t('score.vpn_title')} status={vpnStatus} explanation={t(`score.vpn.${vpnStatus}.explain`)} />
                <ScoreBreakdownCard title={t('score.web_title')} status={webStatus} explanation={t(`score.web.${webStatus}.explain`)} />
                <ScoreBreakdownCard title={t('score.awareness_title')} status={awarenessStatus} explanation={t(`score.awareness.${awarenessStatus}.explain`)} />
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
                    <CardHeader><CardTitle>{t('result.next_steps')}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Button size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handlePdfDownload}>
                            {t('result.pdf_btn')}
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
                            <AccordionTrigger className="px-6 text-lg font-semibold">{t('result.answers_title')}</AccordionTrigger>
                            <AccordionContent className="px-6 pt-2">
                            <div className="space-y-2 text-sm">
                                {allQuestions.map(q => {
                                const answer = answerMap.get(q.id);
                                if (!answer) return null;
                                return (
                                    <div key={q.id} className="flex justify-between items-start p-2 rounded-md hover:bg-accent">
                                    <span className="font-medium text-muted-foreground mr-4">{t(q.labelKey)}:</span>
                                    <span className="text-right font-semibold">{getDisplayValue(q.id, answer)}</span>
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