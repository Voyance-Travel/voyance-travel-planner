/**
 * Generation Poller Hook
 * 
 * Polls trip.itinerary_status AND itinerary_days table while generation is running.
 * Shows progressive day count, detects stale/zombie processes via heartbeat,
 * auto-resumes on stall, and handles ready/failed transitions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { hasCompleteGenerationTables } from '@/services/generationRecovery';

/** Stale threshold: if no heartbeat for 5 minutes, generation is considered dead */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/** Stall threshold for itinerary_days: if no new day in 5 minutes */
const DAY_STALL_THRESHOLD_MS = 5 * 60 * 1000;

const clampProgress = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

export interface GeneratedDaySummary {
  day_number: number;
  title: string;
  theme: string;
  description: string;
  activities?: unknown[];
  created_at?: string;
}

export interface GenerationPollState {
  status: 'idle' | 'polling' | 'ready' | 'failed' | 'stalled' | 'partial';
  completedDays: number;
  totalDays: number;
  progress: number; // 0-100
  error?: string;
  /** Partial days from itinerary_data available during generation */
  partialDays: unknown[];
  /** Day summaries from itinerary_days table for the progress UI */
  generatedDaysList: GeneratedDaySummary[];
  /** Current city being generated (multi-city trips) */
  currentCity?: string | null;
}

interface UseGenerationPollerOptions {
  tripId: string | null;
  /** Whether to start polling immediately */
  enabled?: boolean;
  /** Poll interval in ms (default 2000) */
  interval?: number;
  /** Called when generation completes */
  onReady?: () => void;
  /** Called when generation fails */
  onFailed?: (error: string) => void;
  /** Called when generation is detected as stalled (zombie process) — only after auto-resume fails */
  onStalled?: () => void;
  /** Whether a manual resume is already in flight — suppresses auto-resume to prevent race */
  resumeInFlight?: boolean;
}

const INITIAL_STATE: GenerationPollState = {
  status: 'idle',
  completedDays: 0,
  totalDays: 0,
  progress: 0,
  partialDays: [],
  generatedDaysList: [],
};

export function useGenerationPoller({
  tripId,
  enabled = false,
  interval = 2000,
  onReady,
  onFailed,
  onStalled,
  resumeInFlight = false,
}: UseGenerationPollerOptions) {
  const [state, setState] = useState<GenerationPollState>(INITIAL_STATE);

  const onReadyRef = useRef(onReady);
  const onFailedRef = useRef(onFailed);
  const onStalledRef = useRef(onStalled);
  onReadyRef.current = onReady;
  onFailedRef.current = onFailed;
  onStalledRef.current = onStalled;
  
  // Track whether we already fired onStalled (one notification per stall cycle)
  const stalledFiredRef = useRef(false);
  // Guard: only fire onReady once per generation cycle
  const onReadyCalledRef = useRef(false);
  // High-water mark: completedDays should never decrease during a generation cycle
  const completedDaysHWM = useRef(0);
  // Tab visibility: suppress stalled/failed transitions briefly after tab resumes
  const justResumedRef = useRef(false);
  const resumedAtRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);
  // Dedupe guard: only fire onFailed once per unique error message
  const lastFailedErrorRef = useRef<string | null>(null);

  const poll = useCallback(async () => {
    if (!tripId) return;

    try {
      // Query both trips table and itinerary_days in parallel
      const [tripResult, daysResult] = await Promise.all([
        supabase
          .from('trips')
          .select('itinerary_status, itinerary_data, metadata, start_date, end_date, updated_at')
          .eq('id', tripId)
          .single(),
        supabase
          .from('itinerary_days')
          .select('day_number, title, theme, description, created_at', { count: 'exact' })
          .eq('trip_id', tripId)
          .order('day_number'),
      ]);

      if (tripResult.error || !tripResult.data) return;
      const data = tripResult.data;

      const itineraryStatus = data.itinerary_status as string;
      const meta = (data.metadata as Record<string, unknown>) || {};
      const metaCompletedDays = (meta.generation_completed_days as number) || 0;
      const metaTotalDays = (meta.generation_total_days as number) || 0;
      const currentCity = (meta.generation_current_city as string) || null;

      // Compute canonical total days from date span — this is the source of truth.
      // Metadata can be inflated from legacy multi-city sum-of-days_total.
      let canonicalTotalDays = 0;
      if (data.start_date && data.end_date) {
        const s = new Date(data.start_date as string);
        const e = new Date(data.end_date as string);
        canonicalTotalDays = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }
      // Use canonical when available; fall back to metadata only if dates missing
      const totalDays = canonicalTotalDays > 0 ? canonicalTotalDays : metaTotalDays;

      // Extract partial days from itinerary_data
      const itineraryData = (data.itinerary_data as Record<string, unknown>) || {};
      const partialDays = (itineraryData.days as unknown[]) || [];

      // Get day summaries from itinerary_days table, enriched with activities from itinerary_data
      const daysList: GeneratedDaySummary[] = (daysResult.data || []).map((d: any) => {
        // Activities come from itinerary_data.days (itinerary_days.activities column is not populated)
        const matchingPartialDay = partialDays.find((pd: any) =>
          pd && (pd.dayNumber === d.day_number || pd.day_number === d.day_number)
        ) as any;
        const activities = matchingPartialDay?.activities || [];

        return {
          day_number: d.day_number,
          title: d.title || `Day ${d.day_number}`,
          theme: d.theme || '',
          description: d.description || '',
          activities,
          created_at: d.created_at,
        };
      });
      const dayCount = daysResult.count || daysList.length;

      // Use the BETTER of metadata count vs itinerary_days count,
      // and never let completedDays decrease (high-water mark prevents backward jumps)
      const rawCompletedDays = Math.max(metaCompletedDays, dayCount);
      const completedDays = Math.max(rawCompletedDays, completedDaysHWM.current);
      completedDaysHWM.current = completedDays;
      const progress = clampProgress(totalDays > 0 ? (completedDays / totalDays) * 100 : 0);

      const tablesComplete = totalDays > 0 && dayCount >= totalDays
        ? await hasCompleteGenerationTables(tripId, totalDays).catch(() => false)
        : false;

      // Check for completion — backend uses 'ready', some docs say 'generated'.
      // Honest "Saved" gate: don't fire onReady while backend has explicitly
      // marked metadata.fully_persisted === false (Phase 4/5/6 still running).
      // Legacy trips with no fully_persisted field pass through unchanged.
      // See mem://constraints/itinerary/saved-badge-honesty.
      const fullyPersistedFlag = (meta as any)?.fully_persisted;
      const enrichmentInFlight = fullyPersistedFlag === false;
      if ((itineraryStatus === 'ready' || itineraryStatus === 'generated') && !enrichmentInFlight) {
        stalledFiredRef.current = false;
        setState({ status: 'ready', completedDays: totalDays || completedDays, totalDays, progress: 100, partialDays, generatedDaysList: daysList, currentCity: null });
        if (!onReadyCalledRef.current) {
          onReadyCalledRef.current = true;
          onReadyRef.current?.();
        }
        return;
      }

      if (tablesComplete && !enrichmentInFlight) {
        console.log('[useGenerationPoller] Normalized tables complete — treating as recoverable ready');
        stalledFiredRef.current = false;
        setState({ status: 'ready', completedDays: totalDays, totalDays, progress: 100, partialDays, generatedDaysList: daysList, currentCity: null });
        if (!onReadyCalledRef.current) {
          onReadyCalledRef.current = true;
          onReadyRef.current?.();
        }
        return;
      }

      // Also check: all days exist with REAL activities even if status wasn't updated
      // CRITICAL: Do NOT mark ready from itinerary_days row count alone — shell rows
      // with empty activities caused the Tokyo 8-day regression (trip appears "ready"
      // but no activities exist, causing bounce-back to "Ready to plan your adventure").
      if (totalDays > 0 && data.itinerary_data && !enrichmentInFlight) {
        // Check canonical source: itinerary_data.days must have activities
        const daysWithActivities = partialDays.filter(
          (d: any) => d && Array.isArray(d.activities) && d.activities.length > 0
        ).length;
        if (daysWithActivities >= totalDays) {
          stalledFiredRef.current = false;
          setState({ status: 'ready', completedDays: totalDays, totalDays, progress: 100, partialDays, generatedDaysList: daysList, currentCity: null });
          if (!onReadyCalledRef.current) {
            onReadyCalledRef.current = true;
            onReadyRef.current?.();
          }
          return;
        }
      }

      if (itineraryStatus === 'failed') {
        // CRITICAL: Before reporting failure, check if itinerary data actually exists
        // The status may be stale while the data was successfully written
        if (partialDays.length > 0 && totalDays > 0 && partialDays.length >= totalDays) {
          console.log('[useGenerationPoller] Status is "failed" but itinerary_data has all days — treating as ready');
          stalledFiredRef.current = false;
          setState({ status: 'ready', completedDays: totalDays, totalDays, progress: 100, partialDays, generatedDaysList: daysList, currentCity: null });
          if (!onReadyCalledRef.current) {
            onReadyCalledRef.current = true;
            onReadyRef.current?.();
          }
          return;
        }

        // Also check itinerary_days table — but ONLY if they have real activities
        // Shell rows (activities: []) must NOT be treated as ready
        if (tablesComplete) {
          console.log('[useGenerationPoller] Status is "failed" but normalized tables are complete — treating as ready');
          stalledFiredRef.current = false;
          setState({ status: 'ready', completedDays: totalDays, totalDays, progress: 100, partialDays, generatedDaysList: daysList, currentCity: null });
          if (!onReadyCalledRef.current) {
            onReadyCalledRef.current = true;
            onReadyRef.current?.();
          }
          return;
        }

        if (totalDays > 0 && dayCount >= totalDays) {
          const daysWithRealActivities = partialDays.filter(
            (d: any) => d && Array.isArray(d.activities) && d.activities.length > 0
          ).length;
          if (daysWithRealActivities >= totalDays) {
            console.log('[useGenerationPoller] Status is "failed" but itinerary_data has all days with activities — treating as ready');
            stalledFiredRef.current = false;
            setState({ status: 'ready', completedDays: totalDays, totalDays, progress: 100, partialDays, generatedDaysList: daysList, currentCity: null });
            if (!onReadyCalledRef.current) {
              onReadyCalledRef.current = true;
              onReadyRef.current?.();
            }
            return;
          }
        }

        // Suppress failed transition if we just resumed from a background tab (grace period)
        const inResumeGrace = justResumedRef.current && (Date.now() - resumedAtRef.current < 15000);
        if (inResumeGrace) {
          // Don't show failed yet — stay polling, the next cycle will confirm
          setState({ status: 'polling', completedDays, totalDays, progress, partialDays, generatedDaysList: daysList, currentCity });
          return;
        }

        stalledFiredRef.current = false;
        const genError = (meta.generation_error as string)
          || (meta.chain_error as string)
          || 'Generation failed';
        setState({ status: 'failed', completedDays, totalDays, progress, error: genError, partialDays, generatedDaysList: daysList, currentCity });
        // Dedupe: only fire onFailed once per unique error message
        if (lastFailedErrorRef.current !== genError) {
          lastFailedErrorRef.current = genError;
          onFailedRef.current?.(genError);
        }
        return;
      }

      if (itineraryStatus === 'partial') {
        if (tablesComplete) {
          console.log('[useGenerationPoller] Status is "partial" but normalized tables are complete — treating as ready');
          stalledFiredRef.current = false;
          setState({ status: 'ready', completedDays: totalDays, totalDays, progress: 100, partialDays, generatedDaysList: daysList, currentCity: null });
          if (!onReadyCalledRef.current) {
            onReadyCalledRef.current = true;
            onReadyRef.current?.();
          }
          return;
        }
        stalledFiredRef.current = false;
        const genError = (meta.generation_error as string) || 'Generation paused';
        setState({ status: 'partial', completedDays, totalDays, progress, error: genError, partialDays, generatedDaysList: daysList, currentCity });
        return;
      }

      // Still generating — check for stall using BOTH heartbeat and itinerary_days timestamps
      // BUT skip stall detection during resume grace period (just came back from background tab)
      const inResumeGrace = justResumedRef.current && (Date.now() - resumedAtRef.current < 15000);
      let isStalled = false;

      if (!inResumeGrace) {
        // Method 0: Chain failure detection — backend explicitly marked the chain as broken
        const chainBrokenAt = meta.chain_broken_at_day as number | undefined;
        if (chainBrokenAt && chainBrokenAt > 0 && completedDays < totalDays) {
          console.warn(`[useGenerationPoller] Chain broke at day ${chainBrokenAt}. Triggering stall.`);
          isStalled = true;
        }

        // Method 1: Heartbeat-based stall detection
        if (!isStalled) {
          const heartbeat = meta.generation_heartbeat as string | undefined;
          const startedAt = meta.generation_started_at as string | undefined;
          const referenceTime = heartbeat || startedAt;

          if (referenceTime) {
            const elapsed = Date.now() - new Date(referenceTime).getTime();
            if (elapsed > STALE_THRESHOLD_MS) {
              // Detect silent timeout: stale heartbeat + no chain_error = platform killed the function
              if (!meta.chain_error && !meta.chain_broken_at_day) {
                console.warn(`[useGenerationPoller] Silent timeout detected: heartbeat ${elapsed}ms stale, no chain_error recorded`);
              }
              isStalled = true;
            }
          } else if (itineraryStatus === 'generating') {
            // Method 1a: Heartbeat-less fallback — status says generating but no
            // generation_started_at/heartbeat ever written. Likely a client-driven
            // path (mobile useLovableItinerary loop) where the tab was suspended
            // before any backend heartbeat. After 90s of no metadata, treat as
            // stalled so auto-resume kicks the server-side chain.
            const HEARTBEATLESS_STALL_MS = 90 * 1000;
            const tripUpdatedAt = (data as any).updated_at as string | undefined;
            const lastTouch = tripUpdatedAt ? new Date(tripUpdatedAt).getTime() : 0;
            if (lastTouch && Date.now() - lastTouch > HEARTBEATLESS_STALL_MS) {
              console.warn(`[useGenerationPoller] Heartbeat-less stall: status=generating, no generation_started_at, updated ${Math.round((Date.now()-lastTouch)/1000)}s ago`);
              isStalled = true;
            }
          }
        }

        // Method 1b: Timeout sentinel detection — orphaned sentinel means the function was killed mid-AI-call
        if (!isStalled) {
          const sentinel = meta.generation_timeout_sentinel as { day: number; started_at: string } | undefined;
          if (sentinel?.started_at) {
            const sentinelAge = Date.now() - new Date(sentinel.started_at).getTime();
            if (sentinelAge > 3 * 60 * 1000) { // 3 minutes — tighter than heartbeat threshold
              console.warn(`[useGenerationPoller] Orphaned timeout sentinel: day ${sentinel.day}, age ${Math.round(sentinelAge / 1000)}s`);
              isStalled = true;
            }
          }
        }

        // Method 2: itinerary_days-based stall detection (if days exist but no new one in 5min)
        if (!isStalled && dayCount > 0 && dayCount < (totalDays || Infinity)) {
          const lastDay = daysList[daysList.length - 1];
          if (lastDay?.created_at) {
            const lastCreated = new Date(lastDay.created_at).getTime();
            if (Date.now() - lastCreated > DAY_STALL_THRESHOLD_MS) {
              isStalled = true;
            }
          }
        }
      }

      if (isStalled) {
        // Log stall event to client_errors for server-side correlation.
        // NOTE: This hook MUST NOT auto-invoke `generate-itinerary` from a
        // stall. Background auto-resume re-runs the LLM and silently
        // overwrites the user's existing itinerary with different content
        // (Dublin 2026-05-14 regression). Stall detection is observation
        // only — the user must opt in via the visible Regenerate button
        // (TripDetail.handleResumeGeneration). See
        // mem://constraints/itinerary/no-auto-resume-on-load.
        try {
          supabase.from('client_errors').insert([{
            session_id: sessionStorage.getItem('voy_session_id') || 'unknown',
            error_message: `generation_stalled: day ${completedDays}/${totalDays}`,
            page_path: window.location.pathname,
            component_name: 'useGenerationPoller',
            metadata: { tripId, completedDays, totalDays },
          } as any]).then();
        } catch {}

        // Suppress the stalled UI when a manual resume is already in flight
        // so the spinner doesn't flicker between "stalled" and "polling".
        if (resumeInFlight) {
          setState({ status: 'polling', completedDays, totalDays, progress, partialDays, generatedDaysList: daysList, currentCity });
          return;
        }

        setState({ status: 'stalled', completedDays, totalDays, progress, partialDays, generatedDaysList: daysList, currentCity });
        if (!stalledFiredRef.current) {
          stalledFiredRef.current = true;
          onStalledRef.current?.();
        }
        return;
      }

      // Active generation — progress detected, reset stall tracking
      stalledFiredRef.current = false;
      consecutiveErrorsRef.current = 0; // Reset on success
      setState({ status: 'polling', completedDays, totalDays, progress, partialDays, generatedDaysList: daysList, currentCity });
    } catch (err) {
      consecutiveErrorsRef.current += 1;
      console.warn(`[useGenerationPoller] Poll error (${consecutiveErrorsRef.current}):`, err);
      // Don't change state on first 3 consecutive failures — transient network issues
    }
  }, [tripId]);

  useEffect(() => {
    if (!enabled || !tripId) {
      setState(prev => prev.status === 'idle' ? prev : { ...prev, status: 'idle' });
      stalledFiredRef.current = false;
      onReadyCalledRef.current = false;
      lastFailedErrorRef.current = null;
      completedDaysHWM.current = 0;
      return;
    }

    setState(prev => ({ ...prev, status: 'polling' }));

    // Initial poll — immediate
    poll();

    // Interval-based polling as fallback (8s instead of 2s — realtime handles instant updates)
    const fallbackInterval = Math.max(interval, 8000);
    const timer = setInterval(() => {
      poll();
    }, fallbackInterval);

    // Tab visibility handler: when user returns from background, immediately poll
    // and suppress stalled/failed transitions for a grace period
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        justResumedRef.current = true;
        resumedAtRef.current = Date.now();
        // Immediate fresh poll before any error state can flash
        poll().finally(() => {
          // Clear the resume flag after grace period
          setTimeout(() => {
            justResumedRef.current = false;
          }, 15000);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Debounce realtime-triggered polls to avoid rapid consecutive queries
    let lastRealtimePollTime = 0;
    const debouncedPoll = () => {
      const now = Date.now();
      if (now - lastRealtimePollTime > 3000) { // At most once per 3 seconds
        lastRealtimePollTime = now;
        poll();
      }
    };

    // Realtime subscription for instant updates when new days are inserted
    const channel = supabase
      .channel(`gen-progress-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'itinerary_days',
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          // New day inserted/updated — poll with debounce
          debouncedPoll();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips',
          filter: `id=eq.${tripId}`,
        },
        () => {
          // Trip status changed — poll with debounce
          debouncedPoll();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trip_cities',
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          // City generation status changed — poll with debounce
          debouncedPoll();
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [enabled, tripId, interval, poll]);

  const startPolling = useCallback(() => {
    stalledFiredRef.current = false;
    onReadyCalledRef.current = false;
    lastFailedErrorRef.current = null;
    completedDaysHWM.current = 0;
    setState(prev => ({ ...prev, status: 'polling' }));
  }, []);

  const stopPolling = useCallback(() => {
    setState(prev => ({ ...prev, status: 'idle' }));
  }, []);

  return {
    ...state,
    isPolling: state.status === 'polling',
    isReady: state.status === 'ready',
    isFailed: state.status === 'failed',
    isStalled: state.status === 'stalled',
    isPartial: state.status === 'partial',
    startPolling,
    stopPolling,
  };
}
