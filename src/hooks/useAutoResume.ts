import { useEffect, useRef, useState } from 'react';
import { differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';

interface UseAutoResumeArgs {
  tripId: string | undefined;
  trip: any;
  itineraryDaysCount: number;
  itineraryStatus: string | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
  metadataExpectedDays: number | undefined;
  itineraryDataDays: any[] | undefined;
  handleResumeGeneration: () => Promise<void> | void;
}

export function useAutoResume(args: UseAutoResumeArgs): { isStalled: boolean } {
  const [isStalled, setIsStalled] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!args.tripId || !args.trip) return;

    // Compute expectedTotal from canonical dates first, fall back to metadata.
    let expectedTotal = 0;
    if (args.startDate && args.endDate) {
      try {
        expectedTotal = differenceInDays(
          parseLocalDate(args.endDate),
          parseLocalDate(args.startDate),
        ) + 1;
      } catch { expectedTotal = 0; }
    }
    if (expectedTotal <= 0) expectedTotal = args.metadataExpectedDays ?? 0;

    const jsonDayCount = Array.isArray(args.itineraryDataDays) ? args.itineraryDataDays.length : 0;
    const actualDays = Math.max(jsonDayCount, args.itineraryDaysCount);

    if (expectedTotal <= 0) return;

    // DISABLED auto-fire: regenerating on page load silently overwrites existing
    // content with different LLM output (Dublin 2026-05-14 bug). User must
    // explicitly click Regenerate.
    if (args.itineraryStatus === 'ready' && actualDays > 0 && actualDays < expectedTotal) {
      console.warn(`[useAutoResume] Trip marked ready but ${actualDays}/${expectedTotal} days. NOT auto-resuming.`);
      setIsStalled(true);
      return;
    }
    if (actualDays === 0 && args.itineraryStatus === 'failed') {
      console.warn('[useAutoResume] Trip failed with 0 days. NOT auto-resuming.');
      setIsStalled(true);
      return;
    }

    setIsStalled(false);
    
    if (!attemptedRef.current && args.itineraryStatus === 'pending' && actualDays < expectedTotal) {
      attemptedRef.current = true;
      args.handleResumeGeneration();
    }
  }, [
    args.tripId,
    args.trip,
    args.itineraryDaysCount,
    args.itineraryStatus,
    args.startDate,
    args.endDate,
    args.metadataExpectedDays,
    args.itineraryDataDays,
    args.handleResumeGeneration
  ]);

  return { isStalled };
}
