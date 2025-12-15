import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useFunnelStore } from '@/store/funnel-store';
import { Header } from '@/components/layout/Header';
import { FunnelStep } from '@/components/funnel/FunnelStep';
import { QuestionCard } from '@/components/funnel/QuestionCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { funnelQuestions, techStackQuestions, contactQuestions, TOTAL_STEPS } from '@/lib/questions';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { Lead } from '@shared/types';
import { Toaster, toast } from 'sonner';
export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currentStep = useFunnelStore((s) => s.currentStep);
  const answers = useFunnelStore((s) => s.answers);
  const setAnswer = useFunnelStore((s) => s.setAnswer);
  const nextStep = useFunnelStore((s) => s.nextStep);
  const prevStep = useFunnelStore((s) => s.prevStep);
  const setLanguage = useFunnelStore((s) => s.setLanguage);
  const reset = useFunnelStore((s) => s.reset);
  useEffect(() => {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang && ['de', 'en', 'fr'].includes(urlLang)) {
      i18n.changeLanguage(urlLang);
      setLanguage(urlLang);
    }
  }, [i18n, setLanguage]);
  const progressValue = (currentStep / TOTAL_STEPS) * 100;
  const isStepComplete = useMemo(() => {
    if (currentStep === 0) return true;
    let questionsForStep;
    if (currentStep <= 3) {
        questionsForStep = funnelQuestions.filter(q => q.level === currentStep);
    } else if (currentStep === 4) {
        questionsForStep = techStackQuestions;
    } else {
        questionsForStep = contactQuestions;
    }
    const visibleQuestions = questionsForStep.filter(q => {
        if (!q.dependsOn) return true;
        const dependencyAnswer = answers[q.dependsOn.questionId];
        return Array.isArray(q.dependsOn.value)
            ? q.dependsOn.value.includes(dependencyAnswer as string)
            : dependencyAnswer === q.dependsOn.value;
    });
    if (currentStep === 5) { // Also check consents for the last step
        const contactComplete = visibleQuestions.every(q => {
            if (!q.required) return true;
            const answer = answers[q.id];
            return answer !== undefined && answer !== null && (Array.isArray(answer) ? answer.length > 0 : answer !== '');
        });
        const consentContact = answers.consent_contact === '1';
        return contactComplete && consentContact;
    }
    return visibleQuestions.every(q => {
        if (!q.required) return true;
        const answer = answers[q.id];
        return answer !== undefined && answer !== null && (Array.isArray(answer) ? answer.length > 0 : answer !== '');
    });
  }, [currentStep, answers]);
  const handleSubmit = async () => {
    try {
      const data = { 
        language: useFunnelStore.getState().language, 
        formData: {
          ...answers,
          consent_contact: answers.consent_contact === '1' ? '1' : '0',
          consent_tracking: answers.consent_tracking === '1' ? '1' : '0',
          discount_opt_in: answers.discount_opt_in === '1' ? '1' : '0',
        }
      };
      const lead = await api<Lead>('/api/leads', {
        method:'POST', 
        body:JSON.stringify(data)
      });
      navigate(`/result/${lead.id}`);
      reset();
    } catch(e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      toast.error(errorMessage);
      console.error(e);
    }
  };
  const renderStepContent = () => {
    const getVisibleQuestions = (level: number) =>
      funnelQuestions
        .filter((q) => q.level === level)
        .filter((q) => {
          if (!q.dependsOn) return true;
          const dependencyAnswer = answers[q.dependsOn.questionId];
          return Array.isArray(q.dependsOn.value)
            ? q.dependsOn.value.includes(dependencyAnswer as string)
            : dependencyAnswer === q.dependsOn.value;
        });
    switch (currentStep) {
      case 1:
      case 2:
      case 3:
        return (
          <FunnelStep
            title={t(`step.level_${currentStep}.title`)}
            onNext={nextStep}
            onBack={prevStep}
            isNextDisabled={!isStepComplete}
          >
            {getVisibleQuestions(currentStep).map((q) => (
              <QuestionCard key={q.id} question={q} value={answers[q.id] || (q.type === 'checkbox' ? [] : '')} onChange={(val) => setAnswer(q.id, val)} />
            ))}
          </FunnelStep>
        );
      case 4:
        return (
          <FunnelStep title={t('step.tech_stack.title')} onNext={nextStep} onBack={prevStep} isNextDisabled={!isStepComplete}>
            {techStackQuestions.map((q) => (
              <QuestionCard key={q.id} question={q} value={answers[q.id] || ''} onChange={(val) => setAnswer(q.id, val)} />
            ))}
          </FunnelStep>
        );
      case 5:
        return (
          <FunnelStep title={t('step.contact.title')} onNext={handleSubmit} onBack={prevStep} isLastStep isNextDisabled={!isStepComplete}>
            <Card>
                <CardHeader><CardTitle>{t('step.contact.title')}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {contactQuestions.map((q) => (
                        <div key={q.id}>
                            <Label htmlFor={q.id} className="text-sm font-medium text-muted-foreground">{t(q.labelKey)}</Label>
                            <QuestionCard question={q} value={answers[q.id] || ''} onChange={(val) => setAnswer(q.id, val)} />
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Einwilligungen</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start space-x-2">
                        <Checkbox id="consent_contact" checked={answers.consent_contact === '1'} onCheckedChange={(val) => setAnswer('consent_contact', val ? '1' : '0')} />
                        <Label htmlFor="consent_contact" className="text-sm font-normal">{t('consent.contact')} <span className="text-destructive">*</span></Label>
                    </div>
                    <div className="flex items-start space-x-2">
                        <Checkbox id="consent_tracking" checked={answers.consent_tracking === '1'} onCheckedChange={(val) => setAnswer('consent_tracking', val ? '1' : '0')} />
                        <Label htmlFor="consent_tracking" className="text-sm font-normal">{t('consent.tracking')}</Label>
                    </div>
                    <div className="flex items-start space-x-2">
                        <Checkbox id="discount_opt_in" checked={answers.discount_opt_in === '1'} onCheckedChange={(val) => setAnswer('discount_opt_in', val ? '1' : '0')} />
                        <Label htmlFor="discount_opt_in" className="text-sm font-normal">{t('consent.discount')}</Label>
                    </div>
                </CardContent>
            </Card>
          </FunnelStep>
        );
      default:
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">{t('app.title')}</h1>
            <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">{t('app.subtitle')}</p>
            <Button size="lg" className="mt-8 bg-[#F48120] hover:bg-[#F48120]/90 text-white" onClick={nextStep}>
              {t('app.start_check')}
            </Button>
            <div className="mt-6 text-sm text-muted-foreground">
              <p>{t('app.germany_attacked_info')}</p>
              <a href="https://radar.cloudflare.com/de-de/reports/ddos-2025-q3" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-orange-500 hover:underline">
                {t('app.discover_report')}
                <ExternalLink className="ml-1 h-4 w-4" />
              </a>
            </div>
          </motion.div>
        );
    }
  };
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Toaster richColors />
      <Header />
      <main className="flex-grow flex flex-col items-center justify-center p-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="py-8 md:py-10 lg:py-12">
            <div className="w-full max-w-4xl mx-auto">
              {currentStep > 0 && (
                <div className="mb-8">
                  <Progress value={progressValue} className="w-full [&>div]:bg-orange-500" />
                  <p className="text-center text-sm text-muted-foreground mt-2">Schritt {currentStep} von {TOTAL_STEPS}</p>
                </div>
              )}
              <AnimatePresence mode="wait">
                <div key={currentStep} className="flex justify-center">
                  {renderStepContent()}
                </div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
      <footer className="text-center py-4 text-sm text-muted-foreground">
        Built with ❤️ at Cloudflare
      </footer>
    </div>
  );
}