/**
 * Pre-generation visual phases component
 * Shows engaging visual experience before day-by-day generation starts
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, Heart, Wand2, Check, MapPin, Utensils, Camera, Coffee, Sun, Moon, Compass, Globe, Plane } from 'lucide-react';
import type { GenerationStep } from '@/hooks/useLovableItinerary';

interface GenerationPhasesProps {
  currentStep: GenerationStep;
  destination?: string;
  totalDays?: number;
}

// Fun facts about travel that rotate during loading
const TRAVEL_FACTS = [
  "The best memories come from unplanned moments",
  "Every journey starts with a single step",
  "Adventure awaits around every corner",
  "Travel is the only thing you buy that makes you richer",
  "Collect moments, not just photos",
  "The world is a book, and those who don't travel read only one page",
];

// Preview activities that cycle during loading
const PREVIEW_ACTIVITIES = [
  { icon: Coffee, label: 'Finding hidden cafés', color: 'text-amber-500' },
  { icon: Camera, label: 'Discovering photo spots', color: 'text-blue-500' },
  { icon: Utensils, label: 'Curating local favorites', color: 'text-rose-500' },
  { icon: Compass, label: 'Planning walking routes', color: 'text-emerald-500' },
  { icon: Sun, label: 'Timing golden hours', color: 'text-orange-500' },
  { icon: MapPin, label: 'Mapping neighborhoods', color: 'text-violet-500' },
];

const phases = [
  {
    step: 'gathering-dna' as const,
    icon: Brain,
    title: 'Reading your Travel DNA',
    subtitle: 'Understanding what makes you tick',
  },
  {
    step: 'personalizing' as const,
    icon: Heart,
    title: 'Matching your vibe',
    subtitle: "Finding places you'll actually love",
  },
  {
    step: 'preparing' as const,
    icon: Wand2,
    title: 'Crafting the magic',
    subtitle: 'Building your perfect day-by-day plan',
  },
];

function getPhaseIndex(step: GenerationStep): number {
  if (step === 'gathering-dna') return 0;
  if (step === 'personalizing') return 1;
  if (step === 'preparing') return 2;
  return -1;
}

export function GenerationPhases({ currentStep, destination, totalDays }: GenerationPhasesProps) {
  const currentPhaseIndex = getPhaseIndex(currentStep);
  const [factIndex, setFactIndex] = useState(0);
  const [activityIndex, setActivityIndex] = useState(0);
  
  // Rotate through facts
  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex(prev => (prev + 1) % TRAVEL_FACTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Rotate through preview activities faster
  useEffect(() => {
    const interval = setInterval(() => {
      setActivityIndex(prev => (prev + 1) % PREVIEW_ACTIVITIES.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);
  
  // Only show during pre-generation phases
  if (currentPhaseIndex === -1) return null;

  const currentActivity = PREVIEW_ACTIVITIES[activityIndex];
  const ActivityIcon = currentActivity.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-lg mx-auto px-4"
    >
      {/* Hero section with animated globe */}
      <div className="relative text-center mb-8">
        {/* Animated background rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className="w-32 h-32 rounded-full border border-primary/10"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute w-24 h-24 rounded-full border border-primary/20"
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0.2, 0.7] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
          />
        </div>

        {/* Main icon */}
        <motion.div
          className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-4 shadow-lg"
          animate={{ 
            boxShadow: [
              '0 0 0 0 rgba(var(--primary), 0.2)',
              '0 0 0 20px rgba(var(--primary), 0)',
            ]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <motion.div
            animate={{ rotateY: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <Globe className="w-10 h-10 text-primary" />
          </motion.div>
          
          {/* Orbiting plane */}
          <motion.div
            className="absolute"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            style={{ width: 80, height: 80 }}
          >
            <Plane className="w-4 h-4 text-primary absolute -top-1 left-1/2 -translate-x-1/2 rotate-45" />
          </motion.div>
        </motion.div>

        <h2 className="text-2xl font-serif font-bold text-foreground mb-1">
          Building your {destination || 'dream trip'}
        </h2>
        
        {/* Rotating activity indicator */}
        <div className="h-8 flex items-center justify-center gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activityIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <ActivityIcon className={`w-4 h-4 ${currentActivity.color}`} />
              <span>{currentActivity.label}...</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Compact phase progress - horizontal on mobile */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {phases.map((phase, index) => {
          const isCompleted = index < currentPhaseIndex;
          const isCurrent = index === currentPhaseIndex;
          const Icon = phase.icon;

          return (
            <motion.div
              key={phase.step}
              className="flex items-center gap-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <div
                className={`
                  relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${isCurrent ? 'bg-primary text-primary-foreground shadow-lg scale-110' : ''}
                  ${isCompleted ? 'bg-primary/20 text-primary' : ''}
                  ${!isCurrent && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                `}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <Check className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={isCurrent ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 0.8, repeat: isCurrent ? Infinity : 0 }}
                  >
                    <Icon className="w-5 h-5" />
                  </motion.div>
                )}
                
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </div>

              {/* Connector line (except last) */}
              {index < phases.length - 1 && (
                <div className="w-8 h-0.5 rounded-full overflow-hidden bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: isCompleted ? '100%' : isCurrent ? '50%' : '0%' 
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Current phase details */}
      <motion.div
        key={currentPhaseIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <p className="font-medium text-foreground">
          {phases[currentPhaseIndex]?.title}
        </p>
        <p className="text-sm text-muted-foreground">
          {phases[currentPhaseIndex]?.subtitle}
        </p>
      </motion.div>

      {/* Inspirational quote card */}
      <motion.div
        className="relative bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-6 border border-primary/10 overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* Decorative sparkles */}
        <Sparkles className="absolute top-3 right-3 w-4 h-4 text-primary/30" />
        <Sparkles className="absolute bottom-3 left-3 w-3 h-3 text-primary/20" />
        
        <div className="relative">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            ✨ Travel Inspiration
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={factIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="text-foreground font-medium italic"
            >
              "{TRAVEL_FACTS[factIndex]}"
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress bar at bottom */}
        <div className="mt-4 h-1 rounded-full bg-muted/50 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary/50 via-primary to-primary/50"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '50%' }}
          />
        </div>
      </motion.div>

      {/* Time estimate */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        {totalDays && totalDays > 7
          ? `Takes about ${Math.ceil(totalDays * 1.2)} minutes. You can leave and come back.`
          : totalDays && totalDays > 3
            ? `Takes about ${Math.ceil(totalDays * 1.2)} minutes`
            : 'Usually takes 2-4 minutes'}
      </p>
    </motion.div>
  );
}

export default GenerationPhases;
