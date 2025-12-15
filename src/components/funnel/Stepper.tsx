import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
interface StepperProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}
export function Stepper({ currentStep, totalSteps, labels }: StepperProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);
  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto mb-8 px-4">
      {steps.map((step, index) => {
        const isActive = currentStep === step;
        const isCompleted = currentStep > step;
        return (
          <div key={step} className="flex items-center w-full">
            <div className="flex flex-col items-center">
              <motion.div
                animate={isActive || isCompleted ? 'active' : 'inactive'}
                variants={{
                  active: { scale: 1.2, backgroundColor: 'hsl(var(--primary))' },
                  inactive: { scale: 1, backgroundColor: 'hsl(var(--muted))' },
                }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold relative',
                  isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? '✓' : step}
                {isActive && <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping -z-10" />}
              </motion.div>
              <p className={cn('text-xs mt-2 text-center', isActive ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                {labels[index]}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 bg-border">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: isCompleted ? '100%' : isActive ? '50%' : '0%' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}