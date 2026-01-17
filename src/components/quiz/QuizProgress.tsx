import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizProgressProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
}

export function QuizProgress({ currentStep, totalSteps, stepTitles }: QuizProgressProps) {
  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-4">
        {stepTitles.map((title, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          
          return (
            <div key={index} className="flex items-center flex-1">
              {/* Step circle */}
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isCompleted 
                    ? 'hsl(var(--accent))' 
                    : isCurrent 
                      ? 'hsl(var(--primary))' 
                      : 'hsl(var(--muted))',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0',
                  isCompleted || isCurrent ? 'text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <Check className="w-5 h-5" />
                  </motion.div>
                ) : (
                  index + 1
                )}
              </motion.div>
              
              {/* Connector line */}
              {index < totalSteps - 1 && (
                <div className="flex-1 h-1 mx-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: isCompleted ? '100%' : '0%' }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="h-full bg-accent"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Step labels - visible on larger screens */}
      <div className="hidden md:flex justify-between">
        {stepTitles.map((title, index) => {
          const isCurrent = index === currentStep;
          const isCompleted = index < currentStep;
          
          return (
            <motion.span
              key={index}
              initial={false}
              animate={{
                color: isCurrent || isCompleted 
                  ? 'hsl(var(--foreground))' 
                  : 'hsl(var(--muted-foreground))',
              }}
              className={cn(
                'text-xs font-medium text-center flex-1',
                isCurrent && 'font-semibold'
              )}
            >
              {title}
            </motion.span>
          );
        })}
      </div>
      
      {/* Current step label - mobile */}
      <div className="md:hidden text-center">
        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="text-sm font-medium text-foreground">
          {stepTitles[currentStep]}
        </span>
      </div>
    </div>
  );
}
