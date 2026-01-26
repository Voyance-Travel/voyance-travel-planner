/**
 * Pre-generation visual phases component
 * Shows user-friendly thought process before day-by-day generation starts
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, Heart, Wand2, Check } from 'lucide-react';
import type { GenerationStep } from '@/hooks/useLovableItinerary';

interface GenerationPhasesProps {
  currentStep: GenerationStep;
  destination?: string;
}

const phases = [
  {
    step: 'gathering-dna' as const,
    icon: Brain,
    title: 'Gathering your Travel DNA',
    subtitle: 'Analyzing your preferences and past trips',
  },
  {
    step: 'personalizing' as const,
    icon: Heart,
    title: 'Personalizing recommendations',
    subtitle: 'Matching activities to your unique style',
  },
  {
    step: 'preparing' as const,
    icon: Wand2,
    title: 'Building your perfect itinerary',
    subtitle: 'Crafting a seamless day-by-day experience',
  },
];

function getPhaseIndex(step: GenerationStep): number {
  if (step === 'gathering-dna') return 0;
  if (step === 'personalizing') return 1;
  if (step === 'preparing') return 2;
  return -1;
}

export function GenerationPhases({ currentStep, destination }: GenerationPhasesProps) {
  const currentPhaseIndex = getPhaseIndex(currentStep);
  
  // Only show during pre-generation phases
  if (currentPhaseIndex === -1) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4"
        >
          <Sparkles className="w-8 h-8 text-primary" />
        </motion.div>
        <h2 className="text-xl font-semibold text-foreground">
          Creating your {destination || 'trip'} adventure
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          This usually takes about a minute
        </p>
      </div>

      {/* Phase list */}
      <div className="space-y-3">
        {phases.map((phase, index) => {
          const isCompleted = index < currentPhaseIndex;
          const isCurrent = index === currentPhaseIndex;
          const isPending = index > currentPhaseIndex;
          const Icon = phase.icon;

          return (
            <motion.div
              key={phase.step}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-300
                ${isCurrent ? 'bg-primary/5 border-primary/30 shadow-sm' : ''}
                ${isCompleted ? 'bg-primary/5 border-primary/20' : ''}
                ${isPending ? 'bg-muted/30 border-border/50 opacity-50' : ''}
              `}
            >
              {/* Icon */}
              <div
                className={`
                  flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                  ${isCurrent ? 'bg-primary text-primary-foreground' : ''}
                  ${isCompleted ? 'bg-primary/20 text-primary' : ''}
                  ${isPending ? 'bg-muted text-muted-foreground' : ''}
                `}
              >
                <AnimatePresence mode="wait">
                  {isCompleted ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="icon"
                      animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 1, repeat: isCurrent ? Infinity : 0 }}
                    >
                      <Icon className="w-5 h-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium text-sm ${isPending ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {phase.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {phase.subtitle}
                </p>
              </div>

              {/* Progress indicator for current */}
              {isCurrent && (
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-primary/30"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Bottom shimmer line */}
      <div className="mt-6 h-1 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full w-1/4 bg-gradient-to-r from-transparent via-primary to-transparent"
          animate={{ x: ['0%', '400%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  );
}

export default GenerationPhases;
