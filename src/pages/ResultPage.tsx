import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Download, Calendar, ShieldCheck, Lock, Globe, Users } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { api } from '@/lib/api-client';
import type { GetLeadResponse } from '@shared/types';
import { funnelQuestions, techStackQuestions } from '@/lib/questions';
const allQuestions = [...funnelQuestions, ...techStackQuestions];
const riskLevelColors = {
  low: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    bar: 'hsl(var(--chart-1))',
    gradient: 'from-green-500 to-emerald-500',
  },
  medium: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    bar: 'hsl(var(--chart-2))',
    gradient: 'from-yellow-500 to-amber-500',
  },
  high: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    bar: '#ef4444',
    gradient: 'from-red-500 to-rose-500',
  },
};
const ScoreCard = ({ icon, title, score, maxScore }: { icon: React.ReactNode, title: string, score: number, maxScore: number }) => {
    const percentage = (score / maxScore) * 100;
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
        <Card className="hover:shadow-primary/20 hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{score}/{maxScore}</div>
                <p className={`text-xs ${statusColor}`}>{statusText}</p>
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
  const { riskColors, answerMap } = useMemo(() => {
    if (!data) return { riskColors: riskLevelColors.high, answerMap: new Map() };
    const { scores, answers } = data;
    const riskColors = riskLevelColors[scores.risk_level] || riskLevelColors.high;
    const answerMap = new Map(answers.map(a => [a.question_key, a.answer_value]));
    return { riskColors, answerMap };
  }, [data]);
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-grow max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="py-12 space-y-8">
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center text-center p-4">
        <Header />
        <h2 className="text-2xl font-bold text-destructive">{t('result.error_title', 'Error Loading Results')}</h2>
        <p className="text-muted-foreground mt-2">{error?.message || t('result.error_message', 'The requested lead could not be found.')}</p>
      </div>
    );
  }
  const { lead, scores } = data;
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-grow">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-12 space-y-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Card className={`overflow-hidden shadow-lg border-0 transition-all hover:shadow-2xl hover:scale-[1.01] ${riskColors.bg} ring-1 ring-primary/20`}>
                <CardContent className="text-center p-8 md:p-12">
                  <p className="text-lg font-medium text-muted-foreground">{t('result.title')}</p>
                  <p className="text-2xl font-semibold mt-1">{lead.company_name}</p>
                  <div className="mt-6 text-7xl md:text-8xl font-black tracking-tighter text-gradient-primary drop-shadow-sm">
                    {scores.score_total}%
                  </div>
                  <Badge className={`mt-4 text-xl font-semibold px-8 py-3 rounded-full border-2 ${riskColors.text} border-current bg-transparent`}>
                    {t(`result.risk.${scores.risk_level}`)}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <ScoreCard icon={<Lock />} title={t('score.vpn')} score={scores.score_vpn} maxScore={2} />
                <ScoreCard icon={<Globe />} title={t('score.web')} score={scores.score_web} maxScore={3} />
                <ScoreCard icon={<Users />} title={t('score.awareness')} score={scores.score_awareness} maxScore={2} />
            </motion.div>
            {lead.discount_opt_in === 1 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <div className="p-4 text-center bg-primary text-primary-foreground rounded-lg shadow-md">
                  <p className="font-semibold">{t('result.discount_msg')}</p>
                </div>
              </motion.div>
            )}
            {scores.best_practice_architecture === 1 && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
                    <div className="mt-8 p-6 bg-gradient-primary text-primary-foreground rounded-2xl shadow-xl flex items-center justify-center text-center">
                        <ShieldCheck className="w-10 h-10 mr-4 flex-shrink-0" />
                        <div>
                            <h3 className="text-xl font-bold">{t('result.best_practice_title', 'Best Practice Architecture')}</h3>
                            <p>{t('result.best_practice', 'Ubiquiti Firewall + Cloudflare Zero Trust')}</p>
                        </div>
                    </div>
                </motion.div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                    <Card className="shadow-md h-full">
                        <CardHeader><CardTitle>{t('result.next_steps', 'Next Steps')}</CardTitle></CardHeader>
                        <CardContent className="space-y-4 flex flex-col justify-center">
                            <a href={`/api/leads/${leadId}/pdf`} download={`Security-Check-in-3-Minuten_${leadId}.pdf`} className="btn-cyber w-full flex items-center justify-center text-lg py-4">
                                <Download className="mr-2 h-5 w-5" />
                                {t('result.pdf_btn')}
                            </a>
                            <Button asChild size="lg" variant="outline" className="w-full text-lg py-8">
                                <a href="https://outlook.office.com/book/vonBuschGmbHCloudflare@vonbusch.digital/?ismsaljsauthenabled=true" target="_blank" rel="noopener noreferrer">
                                <Calendar className="mr-2 h-5 w-5" />
                                {t('result.book_btn')}
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
                    <Card className="shadow-md">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="answers">
                                <AccordionTrigger className="px-6 text-lg font-semibold">{t('result.answers_title', 'Detailed Answers')}</AccordionTrigger>
                                <AccordionContent className="px-6 pt-4">
                                <div className="space-y-3">
                                    {allQuestions.map(q => {
                                    const answer = answerMap.get(q.id);
                                    if (!answer) return null;
                                    return (
                                        <div key={q.id} className="flex justify-between items-start text-sm p-2 rounded-md hover:bg-accent">
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
                </motion.div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}