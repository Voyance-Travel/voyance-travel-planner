import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  title: string;
  description: string;
}

interface PlannerHeaderProps {
  activeStep: number;
  steps: Step[];
}

export default function PlannerHeader({ activeStep, steps }: PlannerHeaderProps) {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Step indicators */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < activeStep;
            const isActive = index === activeStep;
            
            return (
              <div key={step.title} className="flex items-center flex-1">
                {/* Step circle */}
                <div className="flex flex-col items-center">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      backgroundColor: isCompleted 
                        ? 'hsl(var(--primary))' 
                        : isActive 
                          ? 'hsl(var(--primary))' 
                          : 'transparent',
                    }}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                      isCompleted || isActive
                        ? 'border-primary'
                        : 'border-slate-300'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5 text-primary-foreground" />
                    ) : (
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isActive ? 'text-primary-foreground' : 'text-slate-400'
                        )}
                      >
                        {index + 1}
                      </span>
                    )}
                  </motion.div>
                  
                  {/* Step label */}
                  <div className="mt-3 text-center">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        isActive ? 'text-slate-900' : 'text-slate-500'
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                      {step.description}
                    </p>
                  </div>
                </div>
                
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-4 hidden sm:block">
                    <div className="h-0.5 bg-slate-200 relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: isCompleted ? '100%' : '0%' }}
                        className="absolute inset-0 bg-primary"
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
