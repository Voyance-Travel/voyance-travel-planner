/**
 * Generation Gate Hook
 * 
 * Pre-authorizes credits before itinerary generation.
 * Routes to full generation or preview based on balance + first-trip status.
 * 
 * Flow:
 * 1. Check if this is user's FIRST trip → mode 'full', 0 credits charged
 * 2. If not first trip: calculate cost, attempt deduction
 * 3. If success → mode 'full'
 * 4. If insufficient → mode 'preview' (2-day cap, no credits)
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

export type GenerationMode = 'full' | 'preview' | 'locked';

export interface GateResult {
  mode: GenerationMode;
  tripCost: number;
  creditsCharged: number;
  currentBalance: number;
  shortfall: number;
  recommendedPack: ReturnType<typeof getRecommendedPackForEstimate>;
  isFirstTrip?: boolean;
  /** Total days the user requested */
  requestedDays: number;
  /** How many days to actually generate (2 for first trip / preview, all for credited) */
  generateDays: number;
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
// HELPERS
// ============================================================================

/**
 * Check if the user has any previously generated itineraries.
 * Returns true if they have zero completed generations (first trip).
 */
async function checkIsFirstTrip(userId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('itinerary_status', 'is', null);

    if (error) {
      console.error('[GenerationGate] First-trip check error:', error);
      return false; // Default to not-first on error (safe fallback)
    }

    return (count ?? 0) === 0;
  } catch {
    return false;
  }
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

    // ────────────────────────────────────────────────────
    // FIRST TRIP: Free full generation, no credits charged
    // ────────────────────────────────────────────────────
    if (user?.id) {
      const isFirstTrip = await checkIsFirstTrip(user.id);
      if (isFirstTrip) {
        console.log('[GenerationGate] First trip detected — granting free 2-day generation');
        return {
          mode: 'full',
          tripCost: 0,
          creditsCharged: 0,
          currentBalance,
          shortfall: 0,
          recommendedPack: null,
          isFirstTrip: true,
          requestedDays: params.days,
          generateDays: Math.min(params.days, 2), // First trip: only 2 days free
        };
      }
    }

    // ────────────────────────────────────────────────────
    // SUBSEQUENT TRIPS: Check credits
    // Simple rule: balance >= cost or LOCKED (no AI, no API calls)
    // ────────────────────────────────────────────────────
    if (!user || currentBalance < tripCost) {
      const shortfall = Math.max(0, tripCost - currentBalance);
      console.log(`[GenerationGate] Insufficient credits: have ${currentBalance}, need ${tripCost} — LOCKED`);
      return {
        mode: 'locked',
        tripCost,
        creditsCharged: 0,
        currentBalance,
        shortfall,
        recommendedPack: getRecommendedPackForEstimate(tripCost, currentBalance),
        requestedDays: params.days,
        generateDays: 0, // No AI generation at all
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
          mode: 'locked',
          tripCost,
          creditsCharged: 0,
          currentBalance,
          shortfall: 0,
          recommendedPack: null,
          requestedDays: params.days,
          generateDays: 0,
        };
      }

      // Handle insufficient credits (402 from edge function)
      if (data?.error === 'Insufficient credits') {
        const available = data.available ?? currentBalance;
        const shortfall = Math.max(0, tripCost - available);
        return {
          mode: 'locked',
          tripCost,
          creditsCharged: 0,
          currentBalance: available,
          shortfall,
          recommendedPack: getRecommendedPackForEstimate(tripCost, available),
          requestedDays: params.days,
          generateDays: 0,
        };
      }

      if (data?.error) {
        console.error('[GenerationGate] Spend error:', data.error);
        return {
          mode: 'locked',
          tripCost,
          creditsCharged: 0,
          currentBalance,
          shortfall: 0,
          recommendedPack: null,
          requestedDays: params.days,
          generateDays: 0,
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
        requestedDays: params.days,
        generateDays: params.days, // Paid: generate ALL days
      };
    } catch (err) {
      console.error('[GenerationGate] Unexpected error:', err);
      return {
        mode: 'locked',
        tripCost,
        creditsCharged: 0,
        currentBalance,
        shortfall: Math.max(0, tripCost - currentBalance),
        recommendedPack: getRecommendedPackForEstimate(tripCost, currentBalance),
        requestedDays: params.days,
        generateDays: 0,
      };
    }
  }, [user, creditData, queryClient]);

  return { authorize };
}

export default useGenerationGate;
