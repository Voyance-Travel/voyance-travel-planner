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

export type GenerationMode = 'full' | 'partial' | 'preview' | 'locked';

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
  journeyId?: string;        // If present, this is a journey leg
  journeyTotalLegs?: number; // Total legs in the journey
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if the user has used their first-trip free benefit.
 * Uses the `first_trip_used` flag on profiles — only set to true
 * after a generation completes successfully, so crashed trips don't
 * consume the benefit.
 */
async function checkIsFirstTrip(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('first_trip_used')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[GenerationGate] First-trip check error:', error);
      return false; // Default to not-first on error (safe fallback)
    }

    return data?.first_trip_used === false;
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
    // Calculate trip cost for this leg
    const estimate = calculateTripCredits(
      {
        days: params.days,
        cities: params.cities,
        mustIncludes: params.mustIncludes,
        includeHotels: params.includeHotels,
      },
      params.dna
    );

    // ── JOURNEY MODE: Canonical cost across all legs ──
    let journeySiblings: Array<{ id: string; start_date: string; end_date: string; destination: string; journey_order: number }> = [];
    let totalJourneyCost = 0;

    if (params.journeyId) {
      // Fetch all sibling legs
      const { data: siblings, error: siblingError } = await supabase
        .from('trips')
        .select('id, start_date, end_date, destination, journey_order')
        .eq('journey_id', params.journeyId)
        .neq('status', 'cancelled')
        .order('journey_order', { ascending: true });

      if (!siblingError && siblings && siblings.length > 1) {
        journeySiblings = siblings;
        // Canonical journey cost: sum all days + all unique cities for proper multi-city fee
        const totalJourneyDays = siblings.reduce((sum, leg) => {
          const legDays = Math.max(1, Math.ceil(
            (new Date(leg.end_date).getTime() - new Date(leg.start_date).getTime()) / (1000 * 60 * 60 * 24)
          ) + 1);
          return sum + legDays;
        }, 0);
        const allCities = Array.from(new Set(siblings.map(s => s.destination).filter(Boolean)));
        const journeyEstimate = calculateTripCredits({
          days: totalJourneyDays,
          cities: allCities,
        });
        totalJourneyCost = journeyEstimate.totalCredits;
        console.log(`[GenerationGate] Journey mode: ${siblings.length} legs, ${totalJourneyDays} days, ${allCities.length} cities, total cost: ${totalJourneyCost} credits`);
      }
    }

    // Use journey total cost when in journey mode, otherwise single-leg cost
    const tripCost = totalJourneyCost > 0 ? totalJourneyCost : estimate.totalCredits;
    const currentBalance = creditData?.totalCredits ?? 0;

    // ────────────────────────────────────────────────────
    // FIRST TRIP: Free full generation, no credits charged
    // ────────────────────────────────────────────────────
    if (user?.id) {
      const isFirstTrip = await checkIsFirstTrip(user.id);
      if (isFirstTrip) {
        console.log('[GenerationGate] First trip detected — generating ALL days free');
        return {
          mode: 'full',
          tripCost: 0,
          creditsCharged: 0,
          currentBalance,
          shortfall: 0,
          recommendedPack: null,
          isFirstTrip: true,
          requestedDays: params.days,
          generateDays: 2, // First trip: only generate days 1-2 free; remaining days generated on unlock
        };
      }
    }

    // ────────────────────────────────────────────────────
    // SUBSEQUENT TRIPS: Check credits
    // Full if can afford all, Partial if can afford ≥1 day, Locked if 0
    // ────────────────────────────────────────────────────
    if (!user || currentBalance < tripCost) {
      const costPerDay = Math.ceil(tripCost / params.days);
      const affordableDays = costPerDay > 0 ? Math.floor(currentBalance / costPerDay) : 0;
      const shortfall = Math.max(0, tripCost - currentBalance);

      if (affordableDays >= 1 && user) {
        // PARTIAL: User can afford some days but not all
        const partialCost = affordableDays * costPerDay;
        console.log(`[GenerationGate] Partial generation: can afford ${affordableDays}/${params.days} days (${partialCost} credits)`);
        
        // Don't deduct yet — deduction happens after user confirms in the UI
        return {
          mode: 'partial',
          tripCost,
          creditsCharged: 0, // Not charged yet — charged after confirmation
          currentBalance,
          shortfall,
          recommendedPack: getRecommendedPackForEstimate(tripCost, currentBalance),
          requestedDays: params.days,
          generateDays: affordableDays,
        };
      }

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
    // Track whether credits were actually spent so we can refund on unexpected errors
    let creditsSpent = 0;
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
        // Network error — if user can afford it, this is a transient failure, not "insufficient"
        console.error('[GenerationGate] Spend error:', error);
        // Throw so ItineraryGenerator shows a generic error, NOT the "out of credits" modal
        throw new Error(`Credit spend failed: ${error.message || 'network error'}`);
      }

      // Handle insufficient credits (from edge function)
      if (data?.code === 'INSUFFICIENT_CREDITS' || data?.error === 'Insufficient credits') {
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
        // Throw so the UI shows a generic retry error, not "out of credits"
        throw new Error(`Credit spend failed: ${data.error}`);
      }

      // Credits deducted successfully — record how much was spent
      creditsSpent = data.spent ?? tripCost;

      // ── JOURNEY: Queue remaining legs for sequential generation ──
      if (journeySiblings.length > 1) {
        const otherLegs = journeySiblings.filter(s => s.id !== params.tripId);
        for (const leg of otherLegs) {
          await supabase
            .from('trips')
            .update({ itinerary_status: 'queued' })
            .eq('id', leg.id);
        }
        console.log(`[GenerationGate] Queued ${otherLegs.length} journey legs for sequential generation`);
      }

      // Refresh credit balance in UI
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
      }

      return {
        mode: 'full',
        tripCost,
        creditsCharged: creditsSpent,
        currentBalance: data.newBalance?.total ?? (currentBalance - tripCost),
        shortfall: 0,
        recommendedPack: null,
        requestedDays: params.days,
        generateDays: params.days, // Paid: generate ALL days
      };
    } catch (err) {
      console.error('[GenerationGate] Unexpected error:', err);

      // DEFENSIVE REFUND: If credits were deducted but the gate is throwing,
      // issue a fire-and-forget refund so the user doesn't lose credits.
      if (creditsSpent > 0) {
        console.warn(`[GenerationGate] Credits (${creditsSpent}) were spent but gate is failing — issuing defensive refund`);
        supabase.functions.invoke('spend-credits', {
          body: {
            action: 'REFUND',
            tripId: params.tripId,
            creditsAmount: creditsSpent,
            metadata: { reason: 'gate_error', originalAction: 'trip_generation' },
          },
        }).then(({ error: refundErr }) => {
          if (refundErr) console.error('[GenerationGate] Defensive refund failed:', refundErr);
          else console.log(`[GenerationGate] Defensive refund succeeded: +${creditsSpent} credits`);
          // Refresh balance after refund
          if (user?.id) queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
        }).catch(e => console.error('[GenerationGate] Defensive refund error:', e));
      }

      // Re-throw non-credit errors so the caller shows a generic retry UI,
      // NOT the "out of credits" modal (which 'locked' mode triggers).
      throw err;
    }
  }, [user, creditData, queryClient]);

  return { authorize };
}

export default useGenerationGate;
