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
import { Download, Calendar, ShieldCheck } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { api } from '@/lib/api-client';
import type { GetLeadResponse } from '@shared/types';
import { funnelQuestions, techStackQuestions } from '@/lib/questions';
const allQuestions = [...funnelQuestions, ...techStackQuestions];
const riskLevelColors = {
  low: {
    bg: 'bg-green-100 dark:bg-green-900/50',
    text: 'text-green-700 dark:text-green-300',
    bar: '#22c55e',
    gradient: 'from-green-500 to-emerald-500',
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/50',
    text: 'text-yellow-700 dark:text-yellow-300',
    bar: '#f59e0b',
    gradient: 'from-yellow-500 to-amber-500',
  },
  high: {
    bg: 'bg-red-100 dark:bg-red-900/50',
    text: 'text-red-700 dark:text-red-300',
    bar: '#ef4444',
    gradient: 'from-red-500 to-rose-500',
  },
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
  const { chartData, riskColors, answerMap } = useMemo(() => {
    if (!data) return { chartData: [], riskColors: riskLevelColors.high, answerMap: new Map() };
    const { scores, answers } = data;
    const riskColors = riskLevelColors[scores.risk_level] || riskLevelColors.high;
    const chartData = [
      { name: t('score.vpn'), score: scores.score_vpn },
      { name: t('score.web'), score: scores.score_web },
      { name: t('score.awareness'), score: scores.score_awareness },
      { name: t('score.stack'), score: scores.score_stack },
      { name: t('score.zero_trust'), score: scores.score_zero_trust },
    ];
    const answerMap = new Map(answers.map(a => [a.question_key, a.answer_value]));
    return { chartData, riskColors, answerMap };
  }, [data, t]);
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="py-8 md:py-10 lg:py-12 space-y-8">
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <Skeleton className="lg:col-span-3 h-96 w-full rounded-xl" />
              <Skeleton className="lg:col-span-2 h-64 w-full rounded-xl" />
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8 md:py-10 lg:py-12 space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Card className={`overflow-hidden shadow-lg border-0 transition-all hover:shadow-2xl hover:scale-[1.01] ${riskColors.bg}`}>
                <CardContent className="text-center p-8">
                  <p className="text-lg font-medium text-muted-foreground">{t('result.title')}</p>
                  <p className="text-2xl font-semibold mt-1">{lead.company_name}</p>
                  <div className={`mt-6 text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br ${riskColors.gradient} drop-shadow-sm`}>
                    {scores.score_total}%
                  </div>
                  <Badge className={`mt-4 text-xl font-semibold px-6 py-2 rounded-full border-2 ${riskColors.text} border-current bg-transparent`}>
                    {t(`result.risk.${scores.risk_level}`)}
                  </Badge>
                </CardContent>
              </Card>
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
                    <div className="mt-8 p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl shadow-xl flex items-center justify-center text-center">
                        <ShieldCheck className="w-10 h-10 mr-4 flex-shrink-0" />
                        <div>
                            <h3 className="text-xl font-bold">{t('result.best_practice_title', 'Best Practice Architecture')}</h3>
                            <p className="text-blue-100">{t('result.best_practice', 'Ubiquiti Firewall + Cloudflare Zero Trust')}</p>
                        </div>
                    </div>
                </motion.div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <motion.div className="lg:col-span-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                <Card className="shadow-md">
                  <CardHeader><CardTitle>{t('result.score_overview', 'Score Overview')}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 11]} hide />
                        <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: 'var(--radius)' }} />
                        <Legend />
                        <Bar dataKey="score" fill={riskColors.bar} radius={[4, 4, 0, 0]} maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div className="lg:col-span-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.6 }}>
                <Card className="shadow-md">
                  <CardHeader><CardTitle>{t('result.next_steps', 'Next Steps')}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <a href={`/api/leads/${leadId}/pdf`} download={`Security-Check-in-3-Minuten_${leadId}.pdf`} className="btn-gradient w-full flex items-center justify-center text-lg py-3">
                      <Download className="mr-2 h-5 w-5" />
                      {t('result.pdf_btn')}
                    </a>
                    <Button asChild size="lg" variant="outline" className="w-full text-lg py-3">
                      <a href="https://outlook.office.com/book/vonBuschGmbHCloudflare@vonbusch.digital/?ismsaljsauthenabled=true" target="_blank" rel="noopener noreferrer">
                        <Calendar className="mr-2 h-5 w-5" />
                        {t('result.book_btn')}
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.8 }}>
              <Card className="shadow-md">
                <Accordion type="single" collapsible>
                  <AccordionItem value="answers">
                    <AccordionTrigger className="px-6 text-lg font-semibold">{t('result.answers_title', 'Detailed Answers')}</AccordionTrigger>
                    <AccordionContent className="px-6 pt-4">
                      <div className="space-y-3">
                        {allQuestions.map(q => {
                          const answer = answerMap.get(q.id);
                          if (!answer) return null;
                          return (
                            <div key={q.id} className="flex justify-between items-start text-sm">
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
      </main>
    </div>
  );
}