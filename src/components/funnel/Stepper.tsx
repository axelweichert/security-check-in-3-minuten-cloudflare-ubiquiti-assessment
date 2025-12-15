import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
interface StepperProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}
export function Stepper({ currentStep, totalSteps, labels }: StepperProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);
  return (
    <div className="flex items-start justify-between w-full max-w-3xl mx-auto mb-12 px-4 sm:px-0">
      {steps.map((step, index) => {
        const isActive = currentStep === step;
        const isCompleted = currentStep > step;
        return (
          <div key={step} className="flex items-center w-full">
            <div className="flex flex-col items-center text-center w-20">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-300',
                  isCompleted ? 'bg-primary text-primary-foreground' : isActive ? 'bg-primary/20 border-2 border-primary text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : step}
              </div>
              <p className={cn(
                'text-xs mt-2 transition-colors duration-300',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}>
                {labels[index]}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 bg-border relative">
                <div
                  className="h-full bg-primary absolute top-0 left-0 transition-all duration-500 ease-out"
                  style={{ width: isCompleted ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}