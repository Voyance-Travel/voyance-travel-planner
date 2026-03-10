/**
 * Unlock Single Day Hook
 * 
 * Handles unlocking a single day from a preview itinerary:
 * 1. Spend credits for 1 day (UNLOCK_DAY credits)
 * 2. Re-generate that day with full enrichment
 * 3. Merge enriched day back into itinerary
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useCredits } from './useCredits';
import { CREDIT_COSTS } from '@/config/pricing';
import { useOutOfCredits } from '@/contexts/OutOfCreditsContext';
import { toast } from 'sonner';
import { toFriendlyError } from '@/utils/friendlyErrors';

export type UnlockDayStep = 'idle' | 'spending' | 'enriching' | 'saving' | 'complete' | 'error';

export interface UnlockDayState {
  step: UnlockDayStep;
  dayNumber: number | null;
  message: string;
  error: string | null;
}

export interface UnlockDayParams {
  tripId: string;
  dayNumber: number;
  totalDays: number;
  destination: string;
  destinationCountry?: string;
  travelers: number;
  startDate: string;
  budgetTier?: string;
  tripType?: string;
}

export function useUnlockDay() {
  const { user } = useAuth();
  const { data: creditData } = useCredits();
  const queryClient = useQueryClient();
  const { showOutOfCredits } = useOutOfCredits();

  const [state, setState] = useState<UnlockDayState>({
    step: 'idle',
    dayNumber: null,
    message: '',
    error: null,
  });

  const totalCredits = creditData?.totalCredits ?? 0;
  const canAfford = totalCredits >= CREDIT_COSTS.UNLOCK_DAY;

  const unlockDay = useCallback(async (
    params: UnlockDayParams,
    onComplete?: (dayNumber: number, enrichedDay: any) => void,
  ) => {
    if (!user) {
      toast.error('Please sign in to unlock days');
      return false;
    }

    if (!canAfford) {
      showOutOfCredits({
        action: 'UNLOCK_DAY',
        creditsNeeded: CREDIT_COSTS.UNLOCK_DAY,
        creditsAvailable: totalCredits,
        tripId: params.tripId,
      });
      return false;
    }

    // Step 1: Spend credits
    setState({
      step: 'spending',
      dayNumber: params.dayNumber,
      message: `Unlocking Day ${params.dayNumber}...`,
      error: null,
    });

    try {
      // Idempotency key prevents duplicate charges from rapid taps
      const idempotencyKey = `unlock_day_${params.tripId}_d${params.dayNumber}_${Date.now()}`;
      const { data: spendData, error: spendError } = await supabase.functions.invoke('spend-credits', {
        body: {
          action: 'unlock_day',
          tripId: params.tripId,
          creditsAmount: CREDIT_COSTS.UNLOCK_DAY,
          idempotencyKey,
          metadata: {
            type: 'single_day_unlock',
            dayNumber: params.dayNumber,
            destination: params.destination,
            idempotencyKey,
          },
        },
      });

      if (spendError) throw new Error(toFriendlyError(spendError.message));
      if (spendData?.error === 'Insufficient credits') {
        showOutOfCredits({
          action: 'UNLOCK_DAY',
          creditsNeeded: CREDIT_COSTS.UNLOCK_DAY,
          creditsAvailable: spendData.available ?? totalCredits,
          tripId: params.tripId,
        });
        setState(prev => ({ ...prev, step: 'idle', dayNumber: null }));
        return false;
      }
      if (spendData?.error) throw new Error(spendData.error);

      queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
    } catch (err: any) {
      setState({ step: 'error', dayNumber: params.dayNumber, message: '', error: err.message });
      toast.error('Failed to process credits. No charges were made.');
      return false;
    }

    // Step 2: Enrich this single day
    setState(prev => ({
      ...prev,
      step: 'enriching',
      message: `Enriching Day ${params.dayNumber} with full details...`,
    }));

    try {
      const dateObj = new Date(params.startDate);
      dateObj.setDate(dateObj.getDate() + params.dayNumber - 1);
      const dateStr = dateObj.toISOString().split('T')[0];

      const { data, error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          action: 'generate-day',
          tripId: params.tripId,
          dayNumber: params.dayNumber,
          totalDays: params.totalDays,
          destination: params.destination,
          destinationCountry: params.destinationCountry,
          date: dateStr,
          travelers: params.travelers,
          tripType: params.tripType,
          budgetTier: params.budgetTier,
        },
      });

      if (error) throw error;
      if (!data?.success && !data?.day) {
        throw new Error(data?.error || `Failed to enrich day ${params.dayNumber}`);
      }

      const enrichedDay = data.day || data;

      // Clear isLocked/isPreview on the enriched day so UI shows it immediately
      if (enrichedDay?.metadata) {
        enrichedDay.metadata.isLocked = false;
        enrichedDay.metadata.isPreview = false;
      }

      // QA-020: Update unlocked_day_count using max-based logic (never decreases)
      try {
        const { data: tripRow } = await supabase
          .from('trips')
          .select('unlocked_day_count')
          .eq('id', params.tripId)
          .maybeSingle();
        const currentCount = (tripRow as any)?.unlocked_day_count ?? 0;
        const newCount = Math.max(currentCount, params.dayNumber);
        await supabase
          .from('trips')
          .update({ unlocked_day_count: newCount } as any)
          .eq('id', params.tripId);
        // Invalidate entitlements, trip, and credits queries for immediate UI update
        queryClient.invalidateQueries({ queryKey: ['entitlements'] });
        queryClient.invalidateQueries({ queryKey: ['trip', params.tripId] });
        queryClient.invalidateQueries({ queryKey: ['credits'] });
      } catch (dbErr) {
        console.error('[UnlockDay] Failed to update unlocked_day_count:', dbErr);
      }

      setState({
        step: 'complete',
        dayNumber: params.dayNumber,
        message: `Day ${params.dayNumber} unlocked!`,
        error: null,
      });

      toast.success(`🎉 Day ${params.dayNumber} unlocked! Full details are now available.`);
      onComplete?.(params.dayNumber, enrichedDay);
      return true;
    } catch (err: any) {
      console.error(`[UnlockDay] Day ${params.dayNumber} enrichment failed:`, err);
      setState({ step: 'error', dayNumber: params.dayNumber, message: '', error: err.message });
      toast.error(toFriendlyError(err?.message) || `Failed to enrich Day ${params.dayNumber}. Credits were charged - please retry.`);
      return false;
    }
  }, [user, canAfford, totalCredits, queryClient, showOutOfCredits]);

  const reset = useCallback(() => {
    setState({ step: 'idle', dayNumber: null, message: '', error: null });
  }, []);

  return {
    state,
    unlockDay,
    reset,
    canAfford,
    totalCredits,
    creditCost: CREDIT_COSTS.UNLOCK_DAY,
    isUnlocking: state.step !== 'idle' && state.step !== 'complete' && state.step !== 'error',
    unlockingDayNumber: state.dayNumber,
  };
}
