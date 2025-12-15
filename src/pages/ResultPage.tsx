import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Download, Calendar } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { GetLeadResponse } from '@shared/types';
const riskLevelColors = {
  low: {
    bg: 'bg-green-100 dark:bg-green-900/50',
    text: 'text-green-800 dark:text-green-200',
    bar: '#22c55e', // green-500
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/50',
    text: 'text-yellow-800 dark:text-yellow-200',
    bar: '#f59e0b', // amber-500
  },
  high: {
    bg: 'bg-red-100 dark:bg-red-900/50',
    text: 'text-red-800 dark:text-red-200',
    bar: '#ef4444', // red-500
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
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-grow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-8 md:py-10 lg:py-12 space-y-8">
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
        <Header />
        <h2 className="text-2xl font-bold text-destructive">Error loading results.</h2>
        <p className="text-muted-foreground">{error?.message || 'The requested lead could not be found.'}</p>
      </div>
    );
  }
  const { lead, scores, answers } = data;
  const riskColors = riskLevelColors[scores.risk_level] || riskLevelColors.high;
  const chartData = [
    { name: 'VPN', score: scores.score_vpn, max: 2 },
    { name: 'Web', score: scores.score_web, max: 3 },
    { name: 'Awareness', score: scores.score_awareness, max: 1 },
    { name: 'Stack', score: scores.score_stack, max: 6 },
    { name: 'Zero Trust', score: scores.score_zero_trust, max: 2 },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8 md:py-10 lg:py-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Card className={`overflow-hidden ${riskColors.bg}`}>
                <CardHeader>
                  <CardTitle className="text-3xl md:text-4xl font-bold text-center">{t('result.title')}</CardTitle>
                </CardHeader>
                <CardContent className="text-center pb-8">
                  <p className="text-lg text-muted-foreground">Für {lead.company_name}</p>
                  <div className="mt-4">
                    <Badge variant="outline" className={`text-2xl font-semibold px-6 py-2 rounded-full border-2 ${riskColors.text} border-current`}>
                      {t(`result.risk.${scores.risk_level}`)}
                    </Badge>
                  </div>
                  <p className="mt-4 text-5xl md:text-7xl font-bold tracking-tighter ${riskColors.text}">
                    {scores.score_total}%
                  </p>
                  <p className="text-muted-foreground">Gesamt-Score</p>
                </CardContent>
              </Card>
            </motion.div>
            {lead.discount_opt_in === 1 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <div className="mt-8 p-4 text-center bg-primary text-primary-foreground rounded-lg">
                  <p className="font-semibold">{t('result.discount_msg')}</p>
                </div>
              </motion.div>
            )}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
              <motion.div className="lg:col-span-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                <Card>
                  <CardHeader><CardTitle>Score-��bersicht</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, dataMax => Math.max(dataMax, 2)]} />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))' }} />
                        <Bar dataKey="score" fill={riskColors.bar}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={riskColors.bar} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div className="lg:col-span-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.6 }}>
                <Card>
                  <CardHeader><CardTitle>Nächste Schritte</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <Button size="lg" className="w-full bg-[#F48120] hover:bg-[#F48120]/90 text-white">
                      <Download className="mr-2 h-5 w-5" />
                      {t('result.pdf_btn')}
                    </Button>
                    <Button asChild size="lg" variant="outline" className="w-full">
                      <a href="https://outlook.office.com/book/vonBuschGmbHCloudflare@vonbusch.digital/?ismsaljsauthenabled=true" target="_blank" rel="noopener noreferrer">
                        <Calendar className="mr-2 h-5 w-5" />
                        {t('result.book_btn')}
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}