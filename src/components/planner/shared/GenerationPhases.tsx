/**
 * Live Generation Progress Component
 * Shows polished day-by-day progress during itinerary generation.
 * Features: shimmer progress bar, rotating status messages,
 * glowing active day card, skeleton pending cards.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Loader2, Clock, PartyPopper } from 'lucide-react';
import { GenerationAnimation } from './GenerationAnimation';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
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
  completedDays?: number;
  generatedDaysList?: GeneratedDaySummary[];
  isComplete?: boolean;
  progress?: number;
  /** Current city being generated (multi-city) */
  currentCity?: string | null;
  /** Whether this is a multi-city trip */
  isMultiCity?: boolean;
  /** Per-city generation status for multi-city progress display */
  tripCities?: Array<{ city_name: string; generation_status: string }>;
}

const STATUS_MESSAGES = [
  "Finding hidden gems locals love...",
  "Mapping the best dining spots...",
  "Optimizing your daily routes...",
  "Adding curated local experiences...",
  "Checking best timing for each spot...",
  "Discovering off-the-beaten-path finds...",
  "Balancing must-sees with local favorites...",
  "Planning the perfect pace for each day...",
];

/** Simulated minimum progress that ticks up while waiting for the first real day */
function useSimulatedProgress(realProgress: number, isActive: boolean) {
  const [simulated, setSimulated] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!isActive) { setSimulated(0); return; }
    if (realProgress > 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setSimulated(0);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSimulated(prev => {
        if (prev >= 18) return prev;
        return prev + (prev < 6 ? 3 : prev < 12 ? 2 : 1);
      });
    }, 1500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [realProgress, isActive]);

  return realProgress > 0 ? realProgress : simulated;
}

/** Drip-feed hook: reveals days one at a time with delays */
function useDripFeedDays(generatedDaysList: GeneratedDaySummary[]) {
  const [visibleDays, setVisibleDays] = useState<GeneratedDaySummary[]>([]);
  const queueRef = useRef<GeneratedDaySummary[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const revealedSetRef = useRef(new Set<number>());

  useEffect(() => {
    const newDays = generatedDaysList.filter(d => !revealedSetRef.current.has(d.day_number));
    if (newDays.length === 0) return;
    queueRef.current = [...queueRef.current, ...newDays];
    newDays.forEach(d => revealedSetRef.current.add(d.day_number));

    const processNext = () => {
      if (queueRef.current.length === 0) return;
      const next = queueRef.current.shift()!;
      setVisibleDays(prev => {
        const merged = [...prev.filter(d => d.day_number !== next.day_number), next];
        merged.sort((a, b) => a.day_number - b.day_number);
        return merged;
      });
      if (queueRef.current.length > 0) {
        timerRef.current = setTimeout(processNext, 700);
      }
    };

    if (!timerRef.current || queueRef.current.length === newDays.length) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(processNext, 400);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [generatedDaysList]);

  return visibleDays;
}

/**
 * Map internal pipeline phase names to user-friendly messages.
 * Returns null for phases that should fall back to rotating fun messages.
 */
function humanizePhase(phase: string): string | null {
  // "day_2_complete" or "day 2/5 complete" → friendly confirmation
  const completeMatch = phase.match(/day\s*_?(\d+)(?:[/_]\d+)?\s*_?complete/i);
  if (completeMatch) return `Day ${completeMatch[1]} is looking great!`;

  // "all_days_complete" or similar final markers
  if (/all.*complete/i.test(phase)) return 'Putting the finishing touches...';

  // All other internal phases (ai_complete, context_loading, post_processing, etc.)
  return null;
}

/** Rotating status message hook — uses real phase data from generation_logs when available */
function useRotatingMessage(tripId?: string, isActive?: boolean) {
  const [index, setIndex] = useState(0);
  const [livePhase, setLivePhase] = useState<string | null>(null);

  // Poll generation_logs for real phase info
  useEffect(() => {
    if (!isActive || !tripId) { setLivePhase(null); return; }

    const poll = async () => {
      try {
        // Filter out stale logs older than 10 minutes to avoid showing orphaned data
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from('generation_logs')
          .select('current_phase, progress_pct, status')
          .eq('trip_id', tripId)
          .gte('created_at', tenMinAgo)
          .neq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.current_phase && data.status !== 'completed' && data.status !== 'failed') {
          const friendly = humanizePhase(data.current_phase);
          setLivePhase(friendly); // null → falls back to rotating STATUS_MESSAGES
        } else {
          setLivePhase(null);
        }
      } catch {
        // Non-critical — fall back to rotating messages
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [tripId, isActive]);

  // Fallback rotating messages
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % STATUS_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return livePhase || STATUS_MESSAGES[index];
}

/** Shimmer progress bar component */
function ShimmerProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden relative">
      <motion.div
        className="h-full rounded-full relative overflow-hidden"
        style={{
          background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))',
        }}
        animate={{ width: `${Math.max(2, progress)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, hsla(0,0%,100%,0.3) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite linear',
          }}
        />
      </motion.div>
    </div>
  );
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
  currentCity,
  isMultiCity = false,
  tripCities = [],
}: GenerationPhasesProps) {
  const visibleDays = useDripFeedDays(generatedDaysList);
  const visibleCompletedCount = visibleDays.length;

  // Use the poller's completedDays (high-water-marked) as the authoritative count
  // so the UI stays consistent even before drip-feed reveals kick in.
  const displayCompletedDays = Math.max(visibleCompletedCount, completedDays);

  const calculatedProgress = totalDays > 0
    ? Math.max(pollerProgress, Math.round((displayCompletedDays / totalDays) * 100))
    : pollerProgress;

  const isActive = !isComplete && !!tripId;
  const displayProgress = useSimulatedProgress(calculatedProgress, isActive);

  const remainingDays = Math.max(0, totalDays - displayCompletedDays);
  const nextDay = displayCompletedDays + 1;
  const allVisibleDaysDone = totalDays > 0 && displayCompletedDays >= totalDays;

  const rotatingMessage = useRotatingMessage(tripId, isActive);

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTriggered = useRef(false);

  useEffect(() => {
    if ((isComplete || allVisibleDaysDone) && !celebrationTriggered.current) {
      celebrationTriggered.current = true;
      setShowCelebration(true);
    }
  }, [isComplete, allVisibleDaysDone]);

  // Elapsed time
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isActive) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(t);
  }, [isActive]);

  // No tripId — preparing
  if (!tripId) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-lg mx-auto px-4 text-center py-12"
      >
        <GenerationAnimation progress={0} className="mb-4" />
        <p className="text-muted-foreground">Preparing your trip...</p>
      </motion.div>
    );
  }

  // Celebration / Complete
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
          {totalDays} {totalDays === 1 ? 'day' : 'days'} in {destination || 'your destination'}, crafted just for you.
        </p>

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

  // Dynamic subtitle based on progress
  const getSubtitle = () => {
    if (allVisibleDaysDone) return 'Almost there, adding final touches';
    if (displayCompletedDays === 0) return 'Researching destinations, restaurants & hidden gems';
    if (displayProgress < 50) return 'Curating your perfect days';
    if (displayProgress < 75) return `${displayCompletedDays} ${displayCompletedDays === 1 ? 'day' : 'days'} complete · ~${Math.max(1, Math.ceil(remainingDays * 1.2))} min remaining`;
    return 'Almost there, adding final touches';
  };

  const cityLabel = isMultiCity && currentCity ? ` · ${currentCity}` : '';
  const headerText = allVisibleDaysDone
    ? 'Finalizing your itinerary…'
    : displayCompletedDays === 0
      ? `Crafting Day 1 of ${totalDays > 0 ? totalDays : 'your trip'}${cityLabel}`
      : `Building Day ${nextDay} of ${totalDays}${cityLabel}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-lg mx-auto px-4"
    >
      {/* Header with animation */}
      <div className="text-center mb-6">
        <GenerationAnimation progress={displayProgress} className="mb-3" />

        <h2 className="text-xl font-serif font-bold text-foreground mb-1">
          {headerText}
        </h2>

        <AnimatePresence mode="wait">
          <motion.p
            key={getSubtitle()}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-muted-foreground"
          >
            {getSubtitle()}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Shimmer progress bar */}
      {totalDays > 0 && (
        <div className="mb-4">
          <ShimmerProgressBar progress={displayProgress} />
          <div className="flex justify-between mt-1.5">
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-xs text-muted-foreground"
            >
              {displayCompletedDays === 0 ? 'Working on Day 1...' : `${displayCompletedDays}/${totalDays} days`}
            </motion.p>
            <p className="text-xs text-muted-foreground font-medium">{Math.round(displayProgress)}%</p>
          </div>
        </div>
      )}

      {/* Multi-city progress checklist */}
      {isMultiCity && tripCities.length > 1 && (
        <div className="flex items-center gap-3 mb-4 justify-center flex-wrap">
          {tripCities.map((city, i) => (
            <div key={i} className="flex items-center gap-1 text-xs">
              {city.generation_status === 'generated' ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : city.generation_status === 'generating' ? (
                <Loader2 className="h-3 w-3 text-primary animate-spin" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-muted-foreground/40" />
              )}
              <span className={city.generation_status === 'generated' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                {city.city_name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Rotating status message */}
      <div className="mb-5 h-5 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={rotatingMessage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-xs text-muted-foreground italic text-center"
          >
            {rotatingMessage}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Day list */}
      <div className="space-y-2 mb-6">
        {/* Completed days */}
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
                            {act.start_time || act.time ? `${act.start_time || act.time} · ` : ''}
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

        {/* Currently generating day — glowing card with spinner */}
        {!isComplete && !allVisibleDaysDone && nextDay <= totalDays && (
          <motion.div
            key={`generating-${nextDay}`}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3 rounded-lg border border-primary/20 bg-card relative overflow-hidden"
            style={{
              animation: 'cardGlow 2s ease-in-out infinite',
            }}
          >
            {/* Subtle shimmer bg */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.03) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s infinite linear',
              }}
            />
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 relative z-10">
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
            </div>
            <div className="min-w-0 flex-1 relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Day {nextDay}</span>
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-sm text-muted-foreground"
                >
                  Generating activities...
                </motion.span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Upcoming days — skeleton shimmer bars */}
        {!isComplete && !allVisibleDaysDone && Array.from({ length: Math.min(2, totalDays - nextDay) }, (_, i) => nextDay + 1 + i).map((dayNum) => (
          <div key={dayNum} className="flex items-start gap-3 p-3 rounded-lg opacity-40">
            <div className="w-6 h-6 rounded-full border border-border/60 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] text-muted-foreground">{dayNum}</span>
            </div>
            <div className="flex-1 space-y-2">
              <div
                className="h-3 w-28 rounded-full bg-muted/60 overflow-hidden"
              >
                <div
                  className="h-full w-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground) / 0.08) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s infinite linear',
                  }}
                />
              </div>
              <div
                className="h-2.5 w-20 rounded-full bg-muted/40 overflow-hidden"
              >
                <div
                  className="h-full w-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground) / 0.06) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s infinite linear',
                    animationDelay: '0.3s',
                  }}
                />
              </div>
            </div>
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
          Feel free to leave. We'll keep building your itinerary in the background. Come back anytime.
        </p>
      </motion.div>
    </motion.div>
  );
}

export default GenerationPhases;
