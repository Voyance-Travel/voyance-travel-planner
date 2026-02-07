/**
 * Generation Gate Hook
 * 
 * Pre-authorizes credits before itinerary generation.
 * Routes to full generation (expensive) or preview (cheap) based on balance.
 * 
 * Flow:
 * 1. Calculate trip cost via tripCostCalculator
 * 2. Attempt to deduct via spend-credits (trip_generation action)
 * 3. If success → mode 'full' (proceed with generate-itinerary)
 * 4. If 402 insufficient → mode 'preview' (use generate-full-preview)
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  calculateTripCredits,
  getRecommendedPackForEstimate,
  type TravelDNA,
} from '@/lib/tripCostCalculator';
import { useCredits } from './useCredits';

// ============================================================================
// TYPES
// ============================================================================

export type GenerationMode = 'full' | 'preview';

export interface GateResult {
  mode: GenerationMode;
  tripCost: number;
  creditsCharged: number;
  currentBalance: number;
  shortfall: number;
  recommendedPack: ReturnType<typeof getRecommendedPackForEstimate>;
}

export interface GenerationGateParams {
  tripId: string;
  days: number;
  cities: string[];
  dna?: TravelDNA;
  mustIncludes?: string[];
  includeHotels?: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useGenerationGate() {
  const { user } = useAuth();
  const { data: creditData } = useCredits();
  const queryClient = useQueryClient();

  /**
   * Pre-authorize credits for trip generation.
   * Returns the generation mode and cost details.
   */
  const authorize = useCallback(async (params: GenerationGateParams): Promise<GateResult> => {
    // Calculate trip cost
    const estimate = calculateTripCredits(
      {
        days: params.days,
        cities: params.cities,
        mustIncludes: params.mustIncludes,
        includeHotels: params.includeHotels,
      },
      params.dna
    );

    const tripCost = estimate.totalCredits;
    const currentBalance = creditData?.totalCredits ?? 0;

    // If user can't afford, skip the API call and go straight to preview
    if (currentBalance < tripCost || !user) {
      const shortfall = Math.max(0, tripCost - currentBalance);
      return {
        mode: 'preview',
        tripCost,
        creditsCharged: 0,
        currentBalance,
        shortfall,
        recommendedPack: getRecommendedPackForEstimate(tripCost, currentBalance),
      };
    }

    // Attempt to deduct credits server-side
    try {
      const { data, error } = await supabase.functions.invoke('spend-credits', {
        body: {
          action: 'trip_generation',
          tripId: params.tripId,
          creditsAmount: tripCost,
          metadata: {
            days: params.days,
            cities: params.cities.length,
            complexity: estimate.complexity.tier,
            multiplier: estimate.complexity.multiplier,
          },
        },
      });

      if (error) {
        // Network error — fall back to preview to avoid charging without generation
        console.error('[GenerationGate] Spend error:', error);
        return {
          mode: 'preview',
          tripCost,
          creditsCharged: 0,
          currentBalance,
          shortfall: 0,
          recommendedPack: null,
        };
      }

      // Handle insufficient credits (402 from edge function)
      if (data?.error === 'Insufficient credits') {
        const available = data.available ?? currentBalance;
        const shortfall = Math.max(0, tripCost - available);
        return {
          mode: 'preview',
          tripCost,
          creditsCharged: 0,
          currentBalance: available,
          shortfall,
          recommendedPack: getRecommendedPackForEstimate(tripCost, available),
        };
      }

      if (data?.error) {
        console.error('[GenerationGate] Spend error:', data.error);
        return {
          mode: 'preview',
          tripCost,
          creditsCharged: 0,
          currentBalance,
          shortfall: 0,
          recommendedPack: null,
        };
      }

      // Credits deducted successfully — proceed with full generation
      // Refresh credit balance in UI
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
      }

      return {
        mode: 'full',
        tripCost,
        creditsCharged: data.spent,
        currentBalance: data.newBalance?.total ?? (currentBalance - tripCost),
        shortfall: 0,
        recommendedPack: null,
      };
    } catch (err) {
      console.error('[GenerationGate] Unexpected error:', err);
      return {
        mode: 'preview',
        tripCost,
        creditsCharged: 0,
        currentBalance,
        shortfall: Math.max(0, tripCost - currentBalance),
        recommendedPack: getRecommendedPackForEstimate(tripCost, currentBalance),
      };
    }
  }, [user, creditData, queryClient]);

  return { authorize };
}

export default useGenerationGate;
