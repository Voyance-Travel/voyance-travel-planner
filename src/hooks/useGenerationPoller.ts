/**
 * Generation Poller Hook
 * 
 * Polls trip.itinerary_status AND itinerary_days table while generation is running.
 * Shows progressive day count, detects stale/zombie processes via heartbeat,
 * auto-resumes on stall, and handles ready/failed transitions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Stale threshold: if no heartbeat for 3 minutes, generation is considered dead */
const STALE_THRESHOLD_MS = 3 * 60 * 1000;

/** Stall threshold for itinerary_days: if no new day in 5 minutes */
const DAY_STALL_THRESHOLD_MS = 5 * 60 * 1000;

export interface GeneratedDaySummary {
  day_number: number;
  title: string;
  theme: string;
  description: string;
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
}

interface UseGenerationPollerOptions {
  tripId: string | null;
  /** Whether to start polling immediately */
  enabled?: boolean;
  /** Poll interval in ms (default 5000) */
  interval?: number;
  /** Called when generation completes */
  onReady?: () => void;
  /** Called when generation fails */
  onFailed?: (error: string) => void;
  /** Called when generation is detected as stalled (zombie process) — only after auto-resume fails */
  onStalled?: () => void;
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
  interval = 5000,
  onReady,
  onFailed,
  onStalled,
}: UseGenerationPollerOptions) {
  const [state, setState] = useState<GenerationPollState>(INITIAL_STATE);

  const onReadyRef = useRef(onReady);
  const onFailedRef = useRef(onFailed);
  const onStalledRef = useRef(onStalled);
  onReadyRef.current = onReady;
  onFailedRef.current = onFailed;
  onStalledRef.current = onStalled;
  
  // Track whether we already fired onStalled / attempted auto-resume
  const stalledFiredRef = useRef(false);
  const autoResumeAttemptedRef = useRef(false);
  // Guard: only fire onReady once per generation cycle
  const onReadyCalledRef = useRef(false);

  const poll = useCallback(async () => {
    if (!tripId) return;

    try {
      // Query both trips table and itinerary_days in parallel
      const [tripResult, daysResult] = await Promise.all([
        supabase
          .from('trips')
          .select('itinerary_status, itinerary_data, metadata')
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
      const totalDays = (meta.generation_total_days as number) || 0;

      // Extract partial days from itinerary_data
      const itineraryData = (data.itinerary_data as Record<string, unknown>) || {};
      const partialDays = (itineraryData.days as unknown[]) || [];

      // Get day summaries from itinerary_days table
      const daysList: GeneratedDaySummary[] = (daysResult.data || []).map((d: any) => ({
        day_number: d.day_number,
        title: d.title || `Day ${d.day_number}`,
        theme: d.theme || '',
        description: d.description || '',
        created_at: d.created_at,
      }));
      const dayCount = daysResult.count || daysList.length;

      // Use the BETTER of metadata count vs itinerary_days count
      const completedDays = Math.max(metaCompletedDays, dayCount);
      const progress = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

      // Check for completion — backend uses 'ready', some docs say 'generated'
      if (itineraryStatus === 'ready' || itineraryStatus === 'generated') {
        stalledFiredRef.current = false;
        autoResumeAttemptedRef.current = false;
        setState({ status: 'ready', completedDays: totalDays || completedDays, totalDays, progress: 100, partialDays, generatedDaysList: daysList });
        if (!onReadyCalledRef.current) {
          onReadyCalledRef.current = true;
          onReadyRef.current?.();
        }
        return;
      }

      // Also check: all days exist even if status wasn't updated
      if (totalDays > 0 && dayCount >= totalDays && data.itinerary_data) {
        stalledFiredRef.current = false;
        autoResumeAttemptedRef.current = false;
        setState({ status: 'ready', completedDays: totalDays, totalDays, progress: 100, partialDays, generatedDaysList: daysList });
        if (!onReadyCalledRef.current) {
          onReadyCalledRef.current = true;
          onReadyRef.current?.();
        }
        return;
      }

      if (itineraryStatus === 'failed') {
        stalledFiredRef.current = false;
        autoResumeAttemptedRef.current = false;
        const genError = (meta.generation_error as string) || 'Generation failed';
        setState({ status: 'failed', completedDays, totalDays, progress, error: genError, partialDays, generatedDaysList: daysList });
        onFailedRef.current?.(genError);
        return;
      }

      if (itineraryStatus === 'partial') {
        stalledFiredRef.current = false;
        autoResumeAttemptedRef.current = false;
        const genError = (meta.generation_error as string) || 'Generation paused';
        setState({ status: 'partial', completedDays, totalDays, progress, error: genError, partialDays, generatedDaysList: daysList });
        return;
      }

      // Still generating — check for stall using BOTH heartbeat and itinerary_days timestamps
      let isStalled = false;

      // Method 1: Heartbeat-based stall detection
      const heartbeat = meta.generation_heartbeat as string | undefined;
      const startedAt = meta.generation_started_at as string | undefined;
      const referenceTime = heartbeat || startedAt;

      if (referenceTime) {
        const elapsed = Date.now() - new Date(referenceTime).getTime();
        if (elapsed > STALE_THRESHOLD_MS) {
          isStalled = true;
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

      if (isStalled) {
        // Auto-resume: try once before showing stalled UI
        if (!autoResumeAttemptedRef.current) {
          autoResumeAttemptedRef.current = true;
          console.log(`[useGenerationPoller] Stall detected. Auto-resuming from day ${completedDays + 1}...`);

          try {
            const { error: resumeError } = await supabase.functions.invoke('generate-itinerary', {
              body: {
                action: 'generate-trip',
                tripId,
                resumeFromDay: completedDays + 1,
                isResume: true,
              },
            });

            if (resumeError) {
              console.error('[useGenerationPoller] Auto-resume failed:', resumeError);
              throw resumeError;
            }

            console.log('[useGenerationPoller] Auto-resume triggered successfully');
            // Stay in polling state — the resumed generation will update status
            setState({ status: 'polling', completedDays, totalDays, progress, partialDays, generatedDaysList: daysList });
            return;
          } catch {
            // Auto-resume failed — fall through to stalled
            console.warn('[useGenerationPoller] Auto-resume failed, showing stalled state');
          }
        }

        // Auto-resume was already attempted or failed
        setState({ status: 'stalled', completedDays, totalDays, progress, partialDays, generatedDaysList: daysList });
        if (!stalledFiredRef.current) {
          stalledFiredRef.current = true;
          onStalledRef.current?.();
        }
        return;
      }

      // Active generation
      stalledFiredRef.current = false;
      setState({ status: 'polling', completedDays, totalDays, progress, partialDays, generatedDaysList: daysList });
    } catch (err) {
      console.warn('[useGenerationPoller] Poll error:', err);
    }
  }, [tripId]);

  useEffect(() => {
    if (!enabled || !tripId) {
      setState(prev => prev.status === 'idle' ? prev : { ...prev, status: 'idle' });
      stalledFiredRef.current = false;
      autoResumeAttemptedRef.current = false;
      onReadyCalledRef.current = false;
      return;
    }

    setState(prev => ({ ...prev, status: 'polling' }));

    // Initial poll
    poll();

    const timer = setInterval(() => {
      poll();
    }, interval);

    return () => clearInterval(timer);
  }, [enabled, tripId, interval, poll]);

  const startPolling = useCallback(() => {
    stalledFiredRef.current = false;
    autoResumeAttemptedRef.current = false;
    onReadyCalledRef.current = false;
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
