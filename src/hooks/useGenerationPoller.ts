/**
 * Generation Poller Hook
 * 
 * Polls trip.itinerary_status while generation is running server-side.
 * Shows progressive day count, detects stale/zombie processes via heartbeat,
 * and handles ready/failed transitions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Stale threshold: if no heartbeat for 3 minutes, generation is considered dead */
const STALE_THRESHOLD_MS = 3 * 60 * 1000;

export interface GenerationPollState {
  status: 'idle' | 'polling' | 'ready' | 'failed' | 'stalled';
  completedDays: number;
  totalDays: number;
  progress: number; // 0-100
  error?: string;
}

interface UseGenerationPollerOptions {
  tripId: string | null;
  /** Whether to start polling immediately */
  enabled?: boolean;
  /** Poll interval in ms (default 3000) */
  interval?: number;
  /** Called when generation completes */
  onReady?: () => void;
  /** Called when generation fails */
  onFailed?: (error: string) => void;
  /** Called when generation is detected as stalled (zombie process) */
  onStalled?: () => void;
}

export function useGenerationPoller({
  tripId,
  enabled = false,
  interval = 3000,
  onReady,
  onFailed,
  onStalled,
}: UseGenerationPollerOptions) {
  const [state, setState] = useState<GenerationPollState>({
    status: 'idle',
    completedDays: 0,
    totalDays: 0,
    progress: 0,
  });

  const onReadyRef = useRef(onReady);
  const onFailedRef = useRef(onFailed);
  const onStalledRef = useRef(onStalled);
  onReadyRef.current = onReady;
  onFailedRef.current = onFailed;
  onStalledRef.current = onStalled;
  
  // Track whether we already fired onStalled to avoid repeated calls
  const stalledFiredRef = useRef(false);

  const poll = useCallback(async () => {
    if (!tripId) return;

    try {
      const { data, error } = await supabase
        .from('trips')
        .select('itinerary_status, itinerary_data, metadata')
        .eq('id', tripId)
        .single();

      if (error || !data) return;

      const itineraryStatus = data.itinerary_status as string;
      const meta = (data.metadata as Record<string, unknown>) || {};
      const completedDays = (meta.generation_completed_days as number) || 0;
      const totalDays = (meta.generation_total_days as number) || 0;
      const progress = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

      if (itineraryStatus === 'ready') {
        stalledFiredRef.current = false;
        setState({ status: 'ready', completedDays: totalDays, totalDays, progress: 100 });
        onReadyRef.current?.();
        return;
      }

      if (itineraryStatus === 'failed') {
        stalledFiredRef.current = false;
        const genError = (meta.generation_error as string) || 'Generation failed';
        setState({ status: 'failed', completedDays, totalDays, progress, error: genError });
        onFailedRef.current?.(genError);
        return;
      }

      // Still generating — check heartbeat for stale detection
      const heartbeat = meta.generation_heartbeat as string | undefined;
      const startedAt = meta.generation_started_at as string | undefined;
      const referenceTime = heartbeat || startedAt;

      if (referenceTime) {
        const elapsed = Date.now() - new Date(referenceTime).getTime();
        if (elapsed > STALE_THRESHOLD_MS) {
          setState({ status: 'stalled', completedDays, totalDays, progress });
          if (!stalledFiredRef.current) {
            stalledFiredRef.current = true;
            onStalledRef.current?.();
          }
          return;
        }
      }

      // Active generation
      stalledFiredRef.current = false;
      setState({ status: 'polling', completedDays, totalDays, progress });
    } catch (err) {
      console.warn('[useGenerationPoller] Poll error:', err);
    }
  }, [tripId]);

  useEffect(() => {
    if (!enabled || !tripId) {
      setState(prev => prev.status === 'idle' ? prev : { ...prev, status: 'idle' });
      stalledFiredRef.current = false;
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
    startPolling,
    stopPolling,
  };
}
