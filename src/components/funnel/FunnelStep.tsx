import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
interface FunnelStepProps {
  title: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack: () => void;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  isNextDisabled?: boolean;
}
export function FunnelStep({
  title,
  children,
  onNext,
  onBack,
  isFirstStep = false,
  isLastStep = false,
  isNextDisabled = false,
}: FunnelStepProps) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="w-full"
    >
      <h2 className="text-2xl md:text-3xl font-semibold mb-8 text-center">{title}</h2>
      <div className="space-y-6">{children}</div>
      <div className="mt-10 flex justify-between items-center">
        {!isFirstStep ? (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('app.back')}
          </Button>
        ) : (
          <div />
        )}
        <Button size="lg" onClick={onNext} disabled={isNextDisabled} className="bg-[#F48120] hover:bg-[#F48120]/90 text-white">
          {isLastStep ? t('app.submit') : t('app.next')}
        </Button>
      </div>
    </motion.div>
  );
}