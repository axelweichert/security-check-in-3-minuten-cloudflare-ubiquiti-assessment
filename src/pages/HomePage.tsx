import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useFunnelStore } from '@/store/funnel-store';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FunnelStep } from '@/components/funnel/FunnelStep';
import { QuestionCard } from '@/components/funnel/QuestionCard';
import { Stepper } from '@/components/funnel/Stepper';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { funnelQuestions, techStackQuestions, contactQuestions, TOTAL_STEPS } from '@/lib/questions';
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
    const payload: any = {
      ...answers,
      language: useFunnelStore.getState().language,
      // Defaults / Normalisierung (damit D1 NOT NULL nie wieder nervt)
      phone: (answers.phone && String(answers.phone).trim().length > 0) ? String(answers.phone).trim() : 'n/a',
      employee_range: answers.employee_range ?? 'unknown',
      firewall_vendor: answers.firewall_vendor ?? 'unknown',
      vpn_technology: answers.vpn_technology ?? 'unknown',
      zero_trust_vendor: answers.zero_trust_vendor ?? 'unknown',
      // Consents sicher als boolean/int (beides wird serverseitig gut handelbar)
      consent_contact: answers.consent_contact === '1' ? true : !!answers.consent_contact,
      consent_tracking: answers.consent_tracking === '1' ? true : !!answers.consent_tracking,
      discount_opt_in: answers.discount_opt_in === '1' ? true : !!answers.discount_opt_in,
    };

    try {
      const res = await api<any>('/api/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      toast.success(t('app.submit_success'));
      const leadId = (res?.lead_id ?? res?.leadId ?? res?.id) as string | undefined;
      if (!leadId) throw new Error("Missing lead_id from /api/submit response");
      navigate(`/result/${leadId}`);
      reset();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('app.submit_error');
      toast.error(msg);
      console.error('Submit error:', e);
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
                            <Label htmlFor={q.id} className="text-sm font-medium mb-2 block">{t(q.labelKey)}</Label>
                            <QuestionCard question={q} value={answers[q.id] || ''} onChange={(val) => setAnswer(q.id, val)} />
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>{t('consents.title')}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start space-x-3">
                        <Checkbox id="consent_contact" checked={answers.consent_contact === '1'} onCheckedChange={(val) => setAnswer('consent_contact', val ? '1' : '0')} />
                        <Label htmlFor="consent_contact" className="text-sm font-normal -mt-1">{t('consent.contact')} <span className="text-destructive">*</span></Label>
                    </div>
                    <div className="flex items-start space-x-3">
                        <Checkbox id="consent_tracking" checked={answers.consent_tracking === '1'} onCheckedChange={(val) => setAnswer('consent_tracking', val ? '1' : '0')} />
                        <Label htmlFor="consent_tracking" className="text-sm font-normal -mt-1">{t('consent.tracking')}</Label>
                    </div>
                    <div className="flex items-start space-x-3">
                        <Checkbox id="discount_opt_in" checked={answers.discount_opt_in === '1'} onCheckedChange={(val) => setAnswer('discount_opt_in', val ? '1' : '0')} />
                        <Label htmlFor="discount_opt_in" className="text-sm font-bold -mt-1">{t('consent.discount')}</Label>
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
            <Card className="p-8 md:p-12 shadow-lg">
                <CardContent className="p-0 space-y-12">
                    <div className="space-y-2 text-center">
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter bg-gradient-primary bg-clip-text text-transparent leading-tight">{t('app.title')}</h1>
                        <p className="text-2xl md:text-3xl lg:text-4xl font-semibold text-foreground/90 max-w-2xl mx-auto">{t('app.subtitle')}</p>
                        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">{t('app.hero_description')}</p>
                    </div>
                    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-6 text-center max-w-md mx-auto">
                       <Card className="shadow-md border-primary/30 bg-accent/50 p-6 md:p-8 rounded-xl">
                         <CardContent className="p-0 space-y-3">
                           <h3 className="text-2xl font-bold text-foreground">{t('app.germany_attacked_info')}</h3>
                           <p className="text-sm text-muted-foreground">{t('app.report_source')}</p>
                           <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                             <a href="https://radar.cloudflare.com/de-de/reports/ddos-2025-q3" target="_blank" rel="noopener noreferrer">{t('app.discover_report')}</a>
                           </Button>
                         </CardContent>
                       </Card>
                    </motion.div>
                    <Button size="lg" className="mt-8 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={nextStep}>
                      {t('app.start_check')}
                    </Button>
                </CardContent>
            </Card>
          </motion.div>
        );
    }
  };
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Toaster richColors />
      <Header />
      <main className="flex-grow flex flex-col items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="py-8 md:py-10 lg:py-12">
            <div className="w-full max-w-3xl mx-auto">
              {currentStep > 0 && (
                <Stepper
                  currentStep={currentStep}
                  totalSteps={TOTAL_STEPS}
                  labels={[t('step.level_1.title'), t('step.level_2.title'), t('step.level_3.title'), t('step.tech_stack.title'), t('step.contact.title')]}
                />
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
      <Footer />
    </div>
  );
}