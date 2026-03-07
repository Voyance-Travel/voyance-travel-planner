/**
 * Live Generation Progress Component
 * Receives polling data as props from parent (single source of truth via useGenerationPoller).
 * Shows real day-by-day progress during generation with activity previews.
 * 
 * KEY UX: Days are "drip-fed" to the UI — even if the poller delivers multiple days
 * at once, they appear one at a time with staggered delays so the user sees
 * "Day 1 ✓ → Day 2 generating → Day 2 ✓ → Day 3 generating → …" progression.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Loader2, Clock, PartyPopper } from 'lucide-react';
import { GenerationAnimation } from './GenerationAnimation';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
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

    // Tick up faster initially for better perceived responsiveness: 3% every 1.5s, max 18%
    intervalRef.current = setInterval(() => {
      setSimulated(prev => {
        if (prev >= 18) return prev;
        return prev + (prev < 6 ? 3 : prev < 12 ? 2 : 1);
      });
    }, 1500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [realProgress, isActive]);

  return realProgress > 0 ? realProgress : simulated;
}

/**
 * Drip-feed hook: reveals days one at a time with delays.
 * Even if poller jumps from 0→5 completed days, the UI shows them
 * appearing sequentially with 700ms gaps.
 */
function useDripFeedDays(generatedDaysList: GeneratedDaySummary[]) {
  const [visibleDays, setVisibleDays] = useState<GeneratedDaySummary[]>([]);
  const queueRef = useRef<GeneratedDaySummary[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const revealedSetRef = useRef(new Set<number>());

  useEffect(() => {
    // Find new days we haven't revealed yet
    const newDays = generatedDaysList.filter(d => !revealedSetRef.current.has(d.day_number));
    if (newDays.length === 0) return;

    // Add to queue
    queueRef.current = [...queueRef.current, ...newDays];
    newDays.forEach(d => revealedSetRef.current.add(d.day_number));

    // Process queue one at a time
    const processNext = () => {
      if (queueRef.current.length === 0) return;
      const next = queueRef.current.shift()!;
      setVisibleDays(prev => {
        // Insert in order and dedupe
        const merged = [...prev.filter(d => d.day_number !== next.day_number), next];
        merged.sort((a, b) => a.day_number - b.day_number);
        return merged;
      });
      // Schedule next reveal
      if (queueRef.current.length > 0) {
        timerRef.current = setTimeout(processNext, 700);
      }
    };

    // If not already processing, start
    if (!timerRef.current || queueRef.current.length === newDays.length) {
      // Clear any existing timer to avoid conflicts
      if (timerRef.current) clearTimeout(timerRef.current);
      // Small delay before first reveal so the "generating" state is visible
      timerRef.current = setTimeout(processNext, 400);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [generatedDaysList]);

  return visibleDays;
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
  // Drip-feed days for smooth progressive reveal
  const visibleDays = useDripFeedDays(generatedDaysList);
  const visibleCompletedCount = visibleDays.length;

  // Use visible count for display, real count for logic
  const displayCompletedDays = visibleCompletedCount;

  // Calculate progress from visible days (what the user sees)
  const calculatedProgress = totalDays > 0
    ? Math.max(pollerProgress, Math.round((displayCompletedDays / totalDays) * 100))
    : pollerProgress;

  const isActive = !isComplete && !!tripId;
  const displayProgress = useSimulatedProgress(calculatedProgress, isActive);

  const remainingDays = Math.max(0, totalDays - displayCompletedDays);
  const nextDay = displayCompletedDays + 1;
  const allVisibleDaysDone = totalDays > 0 && displayCompletedDays >= totalDays;

  // Celebration state: show "ready!" for 3 seconds before signaling parent
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTriggered = useRef(false);

  useEffect(() => {
    if ((isComplete || allVisibleDaysDone) && !celebrationTriggered.current) {
      celebrationTriggered.current = true;
      setShowCelebration(true);
    }
  }, [isComplete, allVisibleDaysDone]);

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

  // Celebration / Complete state
  if (showCelebration) {
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
          className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5"
        >
          <motion.div
            initial={{ rotate: -20 }}
            animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <PartyPopper className="h-10 w-10 text-primary" />
          </motion.div>
        </motion.div>
        <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
          Your itinerary is ready!
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {totalDays} {totalDays === 1 ? 'day' : 'days'} in {destination || 'your destination'} — crafted just for you.
        </p>

        {/* Summary of completed days */}
        <div className="space-y-1.5 mb-6 text-left">
          {visibleDays.map((day, i) => (
            <motion.div
              key={day.day_number}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-primary/5"
            >
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">Day {day.day_number}</span>
              {day.title && <span className="text-sm text-foreground truncate">{day.title}</span>}
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs text-muted-foreground animate-pulse"
        >
          Loading your itinerary...
        </motion.p>
      </motion.div>
    );
  }

  // Build header text
  const headerText = allVisibleDaysDone
    ? 'Finalizing your itinerary…'
    : displayCompletedDays === 0
      ? `Building your ${destination || 'trip'}`
      : `Building Day ${nextDay} of ${totalDays}`;

  // Build subtitle with elapsed time reassurance
  let subtitleText: string;
  if (allVisibleDaysDone) {
    subtitleText = 'Almost there — assembling your trip now';
  } else if (displayCompletedDays === 0) {
    subtitleText = elapsed > 15
      ? 'Still working — this can take a minute for the first day…'
      : 'Getting started...';
  } else {
    subtitleText = `${displayCompletedDays} ${displayCompletedDays === 1 ? 'day' : 'days'} complete · ~${Math.max(1, Math.ceil(remainingDays * 1.2))} min remaining`;
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
              {displayCompletedDays === 0 ? 'Generating...' : `${displayCompletedDays}/${totalDays} days`}
            </motion.p>
            <p className="text-xs text-muted-foreground">{Math.round(displayProgress)}%</p>
          </div>
        </div>
      )}

      {/* Day list */}
      <div className="space-y-2 mb-6">
        {/* Completed days with activities — drip-fed */}
        <AnimatePresence mode="popLayout">
          {visibleDays.map((day) => {
            const activities = ((day as any).activities as ActivityPreview[] | undefined) || [];
            const visibleActivities = activities.slice(0, 3);
            const moreCount = Math.max(0, activities.length - 3);

            return (
              <motion.div
                key={`day-${day.day_number}`}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
                  className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5"
                >
                  <Check className="h-3.5 w-3.5 text-primary" />
                </motion.div>
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
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.1 }}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        >
                          <Clock className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            {act.start_time || act.time ? `${act.start_time || act.time} — ` : ''}
                            {act.title || act.name || 'Activity'}
                          </span>
                        </motion.div>
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
        </AnimatePresence>

        {/* Currently generating day */}
        {!isComplete && !allVisibleDaysDone && nextDay <= totalDays && (
          <motion.div
            key={`generating-${nextDay}`}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card"
          >
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
          </motion.div>
        )}

        {/* Upcoming days (show max 2) */}
        {!isComplete && !allVisibleDaysDone && Array.from({ length: Math.min(2, totalDays - nextDay) }, (_, i) => nextDay + 1 + i).map((dayNum) => (
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
