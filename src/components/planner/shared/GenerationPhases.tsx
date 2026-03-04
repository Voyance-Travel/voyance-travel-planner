/**
 * Live Generation Progress Component
 * Polls itinerary_days and shows real day-by-day progress during generation
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Loader2, Cloud } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import type { GenerationStep } from '@/hooks/useLovableItinerary';

interface GenerationPhasesProps {
  currentStep: GenerationStep;
  destination?: string;
  totalDays?: number;
  tripId?: string;
}

interface PolledDay {
  day_number: number;
  title: string | null;
  theme: string | null;
}

export function GenerationPhases({ currentStep, destination, totalDays, tripId }: GenerationPhasesProps) {
  const [days, setDays] = useState<PolledDay[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!tripId) return;

    const poll = async () => {
      try {
        const { data: currentDays } = await supabase
          .from('itinerary_days')
          .select('day_number, title, theme')
          .eq('trip_id', tripId)
          .order('day_number');

        if (currentDays && currentDays.length > 0) {
          setDays(currentDays);
        }

        const { data: trip } = await supabase
          .from('trips')
          .select('itinerary_status')
          .eq('id', tripId)
          .single();

        if (trip?.itinerary_status) {
          setStatus(trip.itinerary_status as string);
          const s = trip.itinerary_status as string;
          if (s === 'ready' || s === 'generated') {
            setIsComplete(true);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        }
      } catch (e) {
        // Silently continue polling
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tripId]);

  const completedDays = days.length;
  const total = totalDays || 0;
  const remainingDays = Math.max(0, total - completedDays);
  const progress = total > 0 ? (completedDays / total) * 100 : 0;
  const nextDay = completedDays + 1;

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

  // Complete state
  if (isComplete) {
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
          {total} days in {destination || 'your destination'} — loading now...
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-lg mx-auto px-4"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3"
        >
          <Sparkles className="h-6 w-6 text-primary" />
        </motion.div>

        <h2 className="text-xl font-serif font-bold text-foreground mb-1">
          {completedDays === 0 && status !== 'generating'
            ? `Building your ${destination || 'trip'}`
            : `Building Day ${Math.min(nextDay, total)} of ${total}`}
        </h2>

        <p className="text-sm text-muted-foreground">
          {completedDays === 0
            ? 'Getting started...'
            : `${completedDays} ${completedDays === 1 ? 'day' : 'days'} complete · ~${Math.max(1, Math.ceil(remainingDays * 1.2))} min remaining`}
        </p>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right mt-1">{Math.round(progress)}%</p>
        </div>
      )}

      {/* Day list */}
      <div className="space-y-2 mb-6">
        {/* Completed days */}
        {days.map((day) => (
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
              {day.theme && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{day.theme}</p>
              )}
            </div>
          </motion.div>
        ))}

        {/* Currently generating day */}
        {!isComplete && nextDay <= total && (
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
        {!isComplete && Array.from({ length: Math.min(2, total - nextDay) }, (_, i) => nextDay + 1 + i).map((dayNum) => (
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
        <Cloud className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Feel free to leave — we'll keep building your itinerary in the background. Come back anytime.
        </p>
      </motion.div>
    </motion.div>
  );
}

export default GenerationPhases;
