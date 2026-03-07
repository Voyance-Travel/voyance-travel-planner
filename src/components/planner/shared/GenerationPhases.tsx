/**
 * Live Generation Progress Component
 * Receives polling data as props from parent (single source of truth via useGenerationPoller).
 * Shows real day-by-day progress during generation with activity previews.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Loader2, Clock } from 'lucide-react';
import { GenerationAnimation } from './GenerationAnimation';
import { Progress } from '@/components/ui/progress';
import type { GenerationStep } from '@/hooks/useLovableItinerary';
import type { GeneratedDaySummary } from '@/hooks/useGenerationPoller';

interface ActivityPreview {
  title?: string;
  name?: string;
  time?: string;
  start_time?: string;
}

interface GenerationPhasesProps {
  currentStep: GenerationStep;
  destination?: string;
  totalDays?: number;
  tripId?: string;
  /** Data from useGenerationPoller — single source of truth */
  completedDays?: number;
  generatedDaysList?: GeneratedDaySummary[];
  isComplete?: boolean;
  progress?: number;
}

/** Simulated minimum progress that ticks up while waiting for the first real day */
function useSimulatedProgress(realProgress: number, isActive: boolean) {
  const [simulated, setSimulated] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!isActive) {
      setSimulated(0);
      return;
    }

    // When real progress arrives, stop simulation
    if (realProgress > 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setSimulated(0);
      return;
    }

    // Tick up slowly: 1-2% every 2s, max 15%
    intervalRef.current = setInterval(() => {
      setSimulated(prev => {
        if (prev >= 15) return prev;
        return prev + (prev < 5 ? 2 : 1);
      });
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [realProgress, isActive]);

  return realProgress > 0 ? realProgress : simulated;
}

export function GenerationPhases({
  currentStep,
  destination,
  totalDays = 0,
  tripId,
  completedDays = 0,
  generatedDaysList = [],
  isComplete = false,
  progress: pollerProgress = 0,
}: GenerationPhasesProps) {
  // Calculate progress locally from props
  const calculatedProgress = totalDays > 0
    ? Math.max(pollerProgress, Math.round((completedDays / totalDays) * 100))
    : pollerProgress;

  const isActive = !isComplete && !!tripId;
  const displayProgress = useSimulatedProgress(calculatedProgress, isActive);

  const remainingDays = Math.max(0, totalDays - completedDays);
  const nextDay = completedDays + 1;
  const allDaysDone = totalDays > 0 && completedDays >= totalDays;

  // Elapsed time for "still working" reassurance
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isActive) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(t);
  }, [isActive]);

  // No tripId — simple preparing state
  if (!tripId) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-lg mx-auto px-4 text-center py-12"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Preparing your trip...</p>
      </motion.div>
    );
  }

  // Complete state (poller said ready OR all days arrived)
  if (isComplete || allDaysDone) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg mx-auto px-4 text-center py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
        >
          <Check className="h-8 w-8 text-primary" />
        </motion.div>
        <h2 className="text-xl font-serif font-bold text-foreground mb-1">
          Your itinerary is ready!
        </h2>
        <p className="text-sm text-muted-foreground">
          {totalDays} days in {destination || 'your destination'} — loading now...
        </p>
      </motion.div>
    );
  }

  // Build header text
  const headerText = allDaysDone
    ? 'Finalizing your itinerary…'
    : completedDays === 0
      ? `Building your ${destination || 'trip'}`
      : `Building Day ${nextDay} of ${totalDays}`;

  // Build subtitle with elapsed time reassurance
  let subtitleText: string;
  if (allDaysDone) {
    subtitleText = 'Almost there — assembling your trip now';
  } else if (completedDays === 0) {
    subtitleText = elapsed > 15
      ? 'Still working — this can take a minute for the first day…'
      : 'Getting started...';
  } else {
    subtitleText = `${completedDays} ${completedDays === 1 ? 'day' : 'days'} complete · ~${Math.max(1, Math.ceil(remainingDays * 1.2))} min remaining`;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-lg mx-auto px-4"
    >
      {/* Header */}
      <div className="text-center mb-6">
        {/* Airplane/Globe Animation */}
        <GenerationAnimation progress={displayProgress} className="mb-2" />

        <h2 className="text-xl font-serif font-bold text-foreground mb-1">
          {headerText}
        </h2>

        <motion.p
          key={subtitleText}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted-foreground"
        >
          {subtitleText}
        </motion.p>
      </div>

      {/* Progress bar — always show when totalDays known */}
      {totalDays > 0 && (
        <div className="mb-6">
          <Progress value={displayProgress} className="h-2" />
          <div className="flex justify-between mt-1">
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-xs text-muted-foreground"
            >
              {completedDays === 0 ? 'Generating...' : `${completedDays}/${totalDays} days`}
            </motion.p>
            <p className="text-xs text-muted-foreground">{Math.round(displayProgress)}%</p>
          </div>
        </div>
      )}

      {/* Day list */}
      <div className="space-y-2 mb-6">
        {/* Completed days with activities */}
        {generatedDaysList.map((day) => {
          const activities = ((day as any).activities as ActivityPreview[] | undefined) || [];
          const visibleActivities = activities.slice(0, 3);
          const moreCount = Math.max(0, activities.length - 3);

          return (
            <motion.div
              key={day.day_number}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10"
            >
              <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">Day {day.day_number}</span>
                  {day.title && (
                    <span className="text-sm font-medium text-foreground truncate">{day.title}</span>
                  )}
                </div>
                {day.theme && day.theme.trim().toLowerCase() !== (day.title || '').trim().toLowerCase() && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{day.theme}</p>
                )}
                {/* Activity previews */}
                {visibleActivities.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {visibleActivities.map((act, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">
                          {act.start_time || act.time ? `${act.start_time || act.time} — ` : ''}
                          {act.title || act.name || 'Activity'}
                        </span>
                      </div>
                    ))}
                    {moreCount > 0 && (
                      <p className="text-xs text-muted-foreground/70 pl-4">+{moreCount} more</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Currently generating day */}
        {!isComplete && !allDaysDone && nextDay <= totalDays && (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Day {nextDay}</span>
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-sm text-muted-foreground"
                >
                  Generating...
                </motion.span>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming days (show max 2) */}
        {!isComplete && !allDaysDone && Array.from({ length: Math.min(2, totalDays - nextDay) }, (_, i) => nextDay + 1 + i).map((dayNum) => (
          <div key={dayNum} className="flex items-start gap-3 p-3 rounded-lg opacity-30">
            <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] text-muted-foreground">{dayNum}</span>
            </div>
            <div className="h-4 w-32 rounded bg-muted/50" />
          </div>
        ))}
      </div>

      {/* Feel free to leave message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border"
      >
        <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Feel free to leave — we'll keep building your itinerary in the background. Come back anytime.
        </p>
      </motion.div>
    </motion.div>
  );
}

export default GenerationPhases;
