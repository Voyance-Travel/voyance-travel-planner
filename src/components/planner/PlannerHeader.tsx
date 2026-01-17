import { motion } from 'framer-motion';
import React from 'react';
import { cn } from '@/lib/utils';

interface Step {
  title: string;
  description: string;
}

interface PlannerHeaderProps {
  activeStep: number;
  steps: Step[];
  className?: string;
}

export default function PlannerHeader({
  activeStep,
  steps,
  className
}: PlannerHeaderProps) {
  return (
    <header className={cn('relative overflow-hidden bg-slate-900', className)}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-primary/20" />
      
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-white">
          <motion.h1
            className="text-2xl md:text-3xl font-serif font-medium"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            key={activeStep}
          >
            {steps[activeStep]?.title}
          </motion.h1>
          
          <motion.p
            className="text-white/70 mt-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            key={`desc-${activeStep}`}
          >
            {steps[activeStep]?.description}
          </motion.p>
        </div>

        {/* Step indicator */}
        <div className="mt-8">
          <div className="flex items-center space-x-2">
            {steps.map((_step, index) => (
              <React.Fragment key={index}>
                <motion.div
                  className={cn(
                    'w-3 h-3 rounded-full transition-colors',
                    index === activeStep
                      ? 'bg-accent'
                      : index < activeStep
                      ? 'bg-white'
                      : 'bg-white/30'
                  )}
                  initial={false}
                  animate={{
                    scale: index === activeStep ? 1.2 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                />
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-8 transition-colors',
                      index < activeStep ? 'bg-white' : 'bg-white/30'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
