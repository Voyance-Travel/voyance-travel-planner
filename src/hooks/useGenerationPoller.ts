/**
 * Generation Poller Hook
 * 
 * Polls trip.itinerary_status while generation is running server-side.
 * Shows progressive day count and handles ready/failed transitions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GenerationPollState {
  status: 'idle' | 'polling' | 'ready' | 'failed';
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
}

export function useGenerationPoller({
  tripId,
  enabled = false,
  interval = 3000,
  onReady,
  onFailed,
}: UseGenerationPollerOptions) {
  const [state, setState] = useState<GenerationPollState>({
    status: 'idle',
    completedDays: 0,
    totalDays: 0,
    progress: 0,
  });

  const onReadyRef = useRef(onReady);
  const onFailedRef = useRef(onFailed);
  onReadyRef.current = onReady;
  onFailedRef.current = onFailed;

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
        setState({ status: 'ready', completedDays: totalDays, totalDays, progress: 100 });
        onReadyRef.current?.();
        return;
      }

      if (itineraryStatus === 'failed') {
        const genError = (meta.generation_error as string) || 'Generation failed';
        setState({ status: 'failed', completedDays, totalDays, progress, error: genError });
        onFailedRef.current?.(genError);
        return;
      }

      // Still generating
      setState({ status: 'polling', completedDays, totalDays, progress });
    } catch (err) {
      console.warn('[useGenerationPoller] Poll error:', err);
    }
  }, [tripId]);

  useEffect(() => {
    if (!enabled || !tripId) {
      setState(prev => prev.status === 'idle' ? prev : { ...prev, status: 'idle' });
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
    startPolling,
    stopPolling,
  };
}
