/**
 * Journey Progress Hook
 * 
 * Monitors generation progress across all legs of a multi-city journey.
 * Polls all journey legs and provides aggregated status for UI display.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LegStatus = 'pending' | 'generating' | 'ready' | 'failed';

export interface JourneyLegProgress {
  tripId: string;
  city: string;
  order: number;
  status: LegStatus;
  completedDays: number;
  totalDays: number;
  autoChainFailed?: boolean;
}

export interface JourneyProgress {
  journeyId: string;
  journeyName: string;
  totalLegs: number;
  completedLegs: number;
  currentLegOrder: number;
  legs: JourneyLegProgress[];
  isComplete: boolean;
  isGenerating: boolean;
  hasFailed: boolean;
}

interface UseJourneyProgressOptions {
  tripId: string | null;
  enabled?: boolean;
  pollInterval?: number;
}

function mapItineraryStatus(status: string | null): LegStatus {
  if (!status) return 'pending';
  const s = status.toLowerCase();
  if (s === 'ready' || s === 'generated') return 'ready';
  if (s === 'generating' || s === 'queued') return 'generating';
  if (s === 'failed') return 'failed';
  return 'pending';
}

export function useJourneyProgress({
  tripId,
  enabled = true,
  pollInterval = 5000,
}: UseJourneyProgressOptions) {
  const queryClient = useQueryClient();
  const [journeyId, setJourneyId] = useState<string | null>(null);

  // First, check if this trip is part of a journey
  useEffect(() => {
    if (!tripId || !enabled) {
      setJourneyId(null);
      return;
    }

    const checkJourney = async () => {
      const { data } = await supabase
        .from('trips')
        .select('journey_id')
        .eq('id', tripId)
        .maybeSingle();

      setJourneyId(data?.journey_id || null);
    };

    checkJourney();
  }, [tripId, enabled]);

  // Query for journey progress
  const { data: progress, isLoading, error, refetch } = useQuery({
    queryKey: ['journey-progress', journeyId],
    queryFn: async (): Promise<JourneyProgress | null> => {
      if (!journeyId) return null;

      const { data: legs, error } = await supabase
        .from('trips')
        .select('id, destination, journey_order, journey_total_legs, journey_name, itinerary_status, start_date, end_date, metadata')
        .eq('journey_id', journeyId)
        .order('journey_order', { ascending: true });

      if (error || !legs?.length) {
        console.error('[useJourneyProgress] Failed to fetch legs:', error);
        return null;
      }

      const legProgress: JourneyLegProgress[] = legs.map((leg) => {
        const startDate = new Date(leg.start_date);
        const endDate = new Date(leg.end_date);
        const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        
        const meta = (leg.metadata as Record<string, unknown>) || {};
        const completedDays = (meta.generation_completed_days as number) || 0;
        const autoChainFailed = meta.auto_chain_failed === true;
        
        return {
          tripId: leg.id,
          city: leg.destination,
          order: leg.journey_order,
          status: mapItineraryStatus(leg.itinerary_status),
          completedDays,
          totalDays,
          autoChainFailed,
        };
      });

      const completedLegs = legProgress.filter((l) => l.status === 'ready').length;
      const generatingLeg = legProgress.find((l) => l.status === 'generating');
      const failedLeg = legProgress.find((l) => l.status === 'failed' || l.autoChainFailed);

      // Current leg is the one being generated, or the first non-ready leg
      const currentLegOrder = generatingLeg?.order || 
        legProgress.find((l) => l.status !== 'ready')?.order || 
        legs.length;

      return {
        journeyId,
        journeyName: legs[0]?.journey_name || legs.map((l) => l.destination).join(' → '),
        totalLegs: legs[0]?.journey_total_legs || legs.length,
        completedLegs,
        currentLegOrder,
        legs: legProgress,
        isComplete: completedLegs === legs.length,
        isGenerating: !!generatingLeg,
        hasFailed: !!failedLeg,
      };
    },
    enabled: !!journeyId && enabled,
    refetchInterval: (query) => {
      // Only poll if there's active generation
      const data = query.state.data;
      if (data?.isGenerating || (data && !data.isComplete && !data.hasFailed)) {
        return pollInterval;
      }
      return false;
    },
    staleTime: 2000,
  });

  // Manual retry for failed auto-chain
  const retryFailedLeg = useCallback(async (legTripId: string) => {
    // Clear the auto_chain_failed flag
    await supabase
      .from('trips')
      .update({ 
        metadata: { 
          auto_chain_failed: false,
          auto_chain_retry_at: new Date().toISOString(),
        } 
      })
      .eq('id', legTripId);

    // Refetch to update UI
    await refetch();
    
    // Navigate to the leg (caller should handle navigation)
    return legTripId;
  }, [refetch]);

  return {
    progress,
    isLoading,
    error,
    refetch,
    retryFailedLeg,
    isPartOfJourney: !!journeyId,
  };
}
