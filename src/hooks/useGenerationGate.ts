/**
 * Generation Gate Hook
 * 
 * Pre-authorizes credits before itinerary generation.
 * Routes to full generation or preview based on balance + first-trip status.
 * 
 * Multi-City Journey Flow:
 * - Leg 1: Calculate cost for ALL legs combined, charge upfront
 * - Legs 2+: Detect pre-paid journey, bypass credit check
 * 
 * Single-Trip Flow:
 * 1. Check if this is user's FIRST trip → mode 'full', 0 credits charged
 * 2. If not first trip: calculate cost, attempt deduction
 * 3. If success → mode 'full'
 * 4. If insufficient → mode 'locked'
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

/** Represents a single leg in a multi-city journey */
export interface JourneyLeg {
  tripId: string;
  city: string;
  country?: string;
  days: number;
  order: number;
  status: string;
}

/** Journey context for multi-city trips */
export interface JourneyContext {
  journeyId: string;
  journeyName: string;
  totalLegs: number;
  currentLegOrder: number;
  legs: JourneyLeg[];
  totalDays: number;
  cities: string[];
  isFirstLeg: boolean;
  isPrePaid: boolean;
}

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
  /** How many days to actually generate */
  generateDays: number;
  /** Journey context for multi-city trips */
  journeyContext?: JourneyContext;
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
 * Check if the user has used their first-trip free benefit.
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
      return false;
    }

    return data?.first_trip_used === false;
  } catch {
    return false;
  }
}

/**
 * Detect if this trip is part of a multi-city journey and fetch all legs.
 */
async function detectJourneyContext(tripId: string): Promise<JourneyContext | null> {
  try {
    // First, get this trip's journey info
    const { data: trip, error } = await supabase
      .from('trips')
      .select('id, journey_id, journey_name, journey_order, journey_total_legs, destination, destination_country, start_date, end_date, metadata')
      .eq('id', tripId)
      .maybeSingle();

    if (error || !trip?.journey_id) {
      return null; // Not part of a journey
    }

    // Fetch all legs in this journey
    const { data: allLegs, error: legsError } = await supabase
      .from('trips')
      .select('id, destination, destination_country, start_date, end_date, journey_order, itinerary_status')
      .eq('journey_id', trip.journey_id)
      .order('journey_order', { ascending: true });

    if (legsError || !allLegs?.length) {
      console.error('[GenerationGate] Failed to fetch journey legs:', legsError);
      return null;
    }

    // Calculate days for each leg
    const legs: JourneyLeg[] = allLegs.map((leg) => {
      const startDate = new Date(leg.start_date);
      const endDate = new Date(leg.end_date);
      const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      
      return {
        tripId: leg.id,
        city: leg.destination,
        country: leg.destination_country || undefined,
        days,
        order: leg.journey_order,
        status: leg.itinerary_status || 'not_started',
      };
    });

    const totalDays = legs.reduce((sum, leg) => sum + leg.days, 0);
    const cities = legs.map((leg) => leg.city);
    const currentLegOrder = trip.journey_order || 1;
    const isFirstLeg = currentLegOrder === 1;

    // Check if journey is already paid
    const metadata = (trip.metadata as Record<string, unknown>) || {};
    const isPrePaid = metadata.journey_credits_paid === true;

    return {
      journeyId: trip.journey_id,
      journeyName: trip.journey_name || cities.join(' → '),
      totalLegs: trip.journey_total_legs || legs.length,
      currentLegOrder,
      legs,
      totalDays,
      cities,
      isFirstLeg,
      isPrePaid,
    };
  } catch (err) {
    console.error('[GenerationGate] Journey detection error:', err);
    return null;
  }
}

/**
 * Check if a journey has already been paid for (prevents double-charging).
 */
async function checkJourneyAlreadyPaid(journeyId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('metadata')
      .eq('journey_id', journeyId)
      .eq('journey_order', 1)
      .maybeSingle();

    if (error || !data) return false;

    const metadata = (data.metadata as Record<string, unknown>) || {};
    return metadata.journey_credits_paid === true;
  } catch {
    return false;
  }
}

/**
 * Mark all legs of a journey as paid (called after successful upfront charge).
 */
async function markJourneyAsPaid(journeyId: string, creditsCharged: number): Promise<void> {
  try {
    // Get all legs in the journey
    const { data: legs, error } = await supabase
      .from('trips')
      .select('id, metadata')
      .eq('journey_id', journeyId);

    if (error || !legs?.length) {
      console.error('[GenerationGate] Failed to fetch journey legs for marking:', error);
      return;
    }

    // Update each leg with payment metadata
    const updates = legs.map((leg) => {
      const existingMetadata = (leg.metadata as Record<string, unknown>) || {};
      return supabase
        .from('trips')
        .update({
          metadata: {
            ...existingMetadata,
            journey_credits_paid: true,
            journey_credits_amount: creditsCharged,
            journey_payment_at: new Date().toISOString(),
          },
        })
        .eq('id', leg.id);
    });

    await Promise.all(updates);
    console.log(`[GenerationGate] Marked ${legs.length} legs as paid for journey ${journeyId}`);
  } catch (err) {
    console.error('[GenerationGate] Failed to mark journey as paid:', err);
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
    const currentBalance = creditData?.totalCredits ?? 0;

    // ────────────────────────────────────────────────────
    // JOURNEY DETECTION: Check if part of multi-city journey
    // ────────────────────────────────────────────────────
    const journeyContext = await detectJourneyContext(params.tripId);

    // If this is a subsequent leg of an already-paid journey, skip credit check
    if (journeyContext && !journeyContext.isFirstLeg) {
      const isPaid = await checkJourneyAlreadyPaid(journeyContext.journeyId);
      if (isPaid) {
        console.log(`[GenerationGate] Journey ${journeyContext.journeyId} already paid — leg ${journeyContext.currentLegOrder} bypassing credits`);
        return {
          mode: 'full',
          tripCost: 0,
          creditsCharged: 0,
          currentBalance,
          shortfall: 0,
          recommendedPack: null,
          requestedDays: params.days,
          generateDays: params.days,
          journeyContext: { ...journeyContext, isPrePaid: true },
        };
      }
    }

    // Calculate cost — use journey total if first leg, otherwise single trip
    const costParams = journeyContext?.isFirstLeg
      ? {
          days: journeyContext.totalDays,
          cities: journeyContext.cities,
          mustIncludes: params.mustIncludes,
          includeHotels: params.includeHotels,
        }
      : {
          days: params.days,
          cities: params.cities,
          mustIncludes: params.mustIncludes,
          includeHotels: params.includeHotels,
        };

    const estimate = calculateTripCredits(costParams, params.dna);
    const tripCost = estimate.totalCredits;

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
          generateDays: params.days,
          journeyContext: journeyContext || undefined,
        };
      }
    }

    // ────────────────────────────────────────────────────
    // SUBSEQUENT TRIPS: Check credits
    // ────────────────────────────────────────────────────
    if (!user || currentBalance < tripCost) {
      const costPerDay = Math.ceil(tripCost / (journeyContext?.totalDays || params.days));
      const affordableDays = costPerDay > 0 ? Math.floor(currentBalance / costPerDay) : 0;
      const shortfall = Math.max(0, tripCost - currentBalance);

      if (affordableDays >= 1 && user) {
        const partialCost = affordableDays * costPerDay;
        console.log(`[GenerationGate] Partial generation: can afford ${affordableDays}/${params.days} days (${partialCost} credits)`);
        
        return {
          mode: 'partial',
          tripCost,
          creditsCharged: 0,
          currentBalance,
          shortfall,
          recommendedPack: getRecommendedPackForEstimate(tripCost, currentBalance),
          requestedDays: params.days,
          generateDays: affordableDays,
          journeyContext: journeyContext || undefined,
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
        generateDays: 0,
        journeyContext: journeyContext || undefined,
      };
    }

    // ────────────────────────────────────────────────────
    // ATTEMPT CREDIT DEDUCTION
    // ────────────────────────────────────────────────────
    let creditsSpent = 0;
    try {
      const { data, error } = await supabase.functions.invoke('spend-credits', {
        body: {
          action: journeyContext?.isFirstLeg ? 'journey_generation' : 'trip_generation',
          tripId: params.tripId,
          creditsAmount: tripCost,
          metadata: {
            days: journeyContext?.totalDays || params.days,
            cities: journeyContext?.cities.length || params.cities.length,
            complexity: estimate.complexity.tier,
            multiplier: estimate.complexity.multiplier,
            journeyId: journeyContext?.journeyId,
            journeyTotalLegs: journeyContext?.totalLegs,
          },
        },
      });

      if (error) {
        console.error('[GenerationGate] Spend error:', error);
        throw new Error(`Credit spend failed: ${error.message || 'network error'}`);
      }

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
          journeyContext: journeyContext || undefined,
        };
      }

      if (data?.error) {
        console.error('[GenerationGate] Spend error:', data.error);
        throw new Error(`Credit spend failed: ${data.error}`);
      }

      creditsSpent = data.spent ?? tripCost;

      // Mark journey as paid if this is the first leg
      if (journeyContext?.isFirstLeg && creditsSpent > 0) {
        await markJourneyAsPaid(journeyContext.journeyId, creditsSpent);
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
        generateDays: params.days,
        journeyContext: journeyContext || undefined,
      };
    } catch (err) {
      console.error('[GenerationGate] Unexpected error:', err);

      // DEFENSIVE REFUND
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
          if (user?.id) queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
        }).catch(e => console.error('[GenerationGate] Defensive refund error:', e));
      }

      throw err;
    }
  }, [user, creditData, queryClient]);

  return { authorize };
}

export default useGenerationGate;
