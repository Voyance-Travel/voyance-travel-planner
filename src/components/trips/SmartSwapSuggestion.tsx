/**
 * SmartSwapSuggestion
 * Context-aware banner that detects timing issues during live trips
 * and suggests swapping the next activity for something nearby.
 * 
 * Triggers when:
 * - Next activity is far away and user is running late
 * - Current time has passed the activity start time
 * - Free time gap is too large between activities
 */

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightLeft, Clock, MapPin, X, ChevronRight, Sparkles } from 'lucide-react';
import { differenceInMinutes, format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  name: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  location?: {
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  type?: string;
  category?: string;
}

interface SwapReason {
  type: 'running_late' | 'too_far' | 'passed_start' | 'long_gap';
  message: string;
  suggestion: string;
}

interface SmartSwapSuggestionProps {
  currentActivity: Activity | null;
  nextActivity: Activity | null;
  dayDate: string;
  completedActivities: Set<string>;
  onSwapRequest: (activityId: string) => void;
  className?: string;
}

function detectSwapReason(
  nextActivity: Activity | null,
  dayDate: string,
): SwapReason | null {
  if (!nextActivity?.startTime) return null;

  // Don't suggest swaps for past days
  const dayStart = parseLocalDate(dayDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dayStart < today) return null;

  const now = new Date();
  const [hours, minutes] = nextActivity.startTime.split(':').map(Number);
  const activityStart = new Date(parseLocalDate(dayDate));
  activityStart.setHours(hours, minutes);

  const minsUntilStart = differenceInMinutes(activityStart, now);

  // Activity start time has already passed and user hasn't checked in
  if (minsUntilStart < -15) {
    return {
      type: 'passed_start',
      message: `${nextActivity.name} started ${Math.abs(minsUntilStart)} mins ago`,
      suggestion: 'Swap for something nearby you can do now?',
    };
  }

  // Running late — less than 10 mins to get there
  if (minsUntilStart > 0 && minsUntilStart < 10) {
    return {
      type: 'running_late',
      message: `${nextActivity.name} starts in ${minsUntilStart} min`,
      suggestion: 'Tight on time? Swap for something closer.',
    };
  }

  // Big gap — more than 2 hours until next activity
  if (minsUntilStart > 120) {
    const startFormatted = format(activityStart, 'h:mm a');
    return {
      type: 'long_gap',
      message: `Nothing until ${startFormatted} (${Math.round(minsUntilStart / 60)}h away)`,
      suggestion: 'Fill the gap with a quick experience nearby?',
    };
  }

  return null;
}

export function SmartSwapSuggestion({
  currentActivity,
  nextActivity,
  dayDate,
  completedActivities,
  onSwapRequest,
  className,
}: SmartSwapSuggestionProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const swapReason = useMemo(() => {
    if (!nextActivity) return null;
    if (completedActivities.has(nextActivity.id)) return null;
    if (dismissed.has(nextActivity.id)) return null;
    return detectSwapReason(nextActivity, dayDate);
  }, [nextActivity, dayDate, completedActivities, dismissed]);

  const handleDismiss = useCallback(() => {
    if (nextActivity) {
      setDismissed(prev => new Set([...prev, nextActivity.id]));
    }
  }, [nextActivity]);

  const handleSwap = useCallback(() => {
    if (nextActivity) {
      onSwapRequest(nextActivity.id);
    }
  }, [nextActivity, onSwapRequest]);

  if (!swapReason || !nextActivity) return null;

  const bgColor = swapReason.type === 'passed_start'
    ? 'from-destructive/10 to-destructive/5 border-destructive/25'
    : swapReason.type === 'running_late'
      ? 'from-amber-500/10 to-amber-500/5 border-amber-500/25'
      : 'from-primary/10 to-primary/5 border-primary/25';

  const iconColor = swapReason.type === 'passed_start'
    ? 'text-destructive'
    : swapReason.type === 'running_late'
      ? 'text-amber-600'
      : 'text-primary';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className={className}
      >
        <div className={cn(
          'rounded-xl border bg-gradient-to-r p-4',
          bgColor
        )}>
          <div className="flex items-start gap-3">
            <div className={cn('mt-0.5', iconColor)}>
              {swapReason.type === 'long_gap' ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {swapReason.message}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {swapReason.suggestion}
              </p>

              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleSwap}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Swap Activity
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={handleDismiss}
                >
                  Keep it
                </Button>
              </div>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={handleDismiss}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
