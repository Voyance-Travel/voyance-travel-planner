/**
 * Unlock Trip Hook
 * 
 * Handles the full unlock flow for preview itineraries:
 * 1. Calculate trip cost (days × 60 credits per day via CREDIT_COSTS.UNLOCK_DAY)
 * 2. Spend credits via spend-credits edge function
 * 3. Re-generate each day with full enrichment via generate-itinerary
 * 4. Save enriched itinerary and clear isPreview flag
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useCredits } from './useCredits';
import { CREDIT_COSTS } from '@/config/pricing';
import { toast } from 'sonner';

export type UnlockStep = 'idle' | 'spending' | 'enriching' | 'saving' | 'complete' | 'error';

export interface UnlockState {
  step: UnlockStep;
  progress: number;
  currentDay: number;
  totalDays: number;
  message: string;
  error: string | null;
}

export interface UnlockTripParams {
  tripId: string;
  totalDays: number;
  destination: string;
  destinationCountry?: string;
  travelers: number;
  startDate: string;
  budgetTier?: string;
  tripType?: string;
}

export function useUnlockTrip() {
  const { user } = useAuth();
  const { data: creditData } = useCredits();
  const queryClient = useQueryClient();

  const [state, setState] = useState<UnlockState>({
    step: 'idle',
    progress: 0,
    currentDay: 0,
    totalDays: 0,
    message: '',
    error: null,
  });

  const totalCredits = creditData?.totalCredits ?? 0;

  /**
   * Calculate the credit cost to unlock a full trip
   */
  const getUnlockCost = useCallback((totalDays: number): number => {
    return totalDays * CREDIT_COSTS.UNLOCK_DAY;
  }, []);

  /**
   * Check if user can afford to unlock
   */
  const canAfford = useCallback((totalDays: number): boolean => {
    return totalCredits >= getUnlockCost(totalDays);
  }, [totalCredits, getUnlockCost]);

  /**
   * Execute the full unlock flow
   */
  const unlock = useCallback(async (
    params: UnlockTripParams,
    onComplete?: (enrichedItinerary: any) => void,
  ) => {
    if (!user) {
      toast.error('Please sign in to unlock your itinerary');
      return false;
    }

    const unlockCost = getUnlockCost(params.totalDays);

    // Step 1: Spend credits
    setState({
      step: 'spending',
      progress: 5,
      currentDay: 0,
      totalDays: params.totalDays,
      message: 'Reserving credits...',
      error: null,
    });

    try {
      const { data: spendData, error: spendError } = await supabase.functions.invoke('spend-credits', {
        body: {
          action: 'unlock_day',
          tripId: params.tripId,
          creditsAmount: unlockCost,
          metadata: {
            type: 'full_trip_unlock',
            days: params.totalDays,
            destination: params.destination,
          },
        },
      });

      if (spendError) throw new Error(spendError.message || 'Failed to spend credits');
      if (spendData?.error === 'Insufficient credits') {
        setState(prev => ({ ...prev, step: 'error', error: 'insufficient_credits' }));
        return false;
      }
      if (spendData?.error) throw new Error(spendData.error);

      // Refresh credit balance
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
      }
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: err.message || 'Failed to spend credits',
      }));
      toast.error('Failed to process credits. No charges were made.');
      return false;
    }

    // Step 2: Re-generate each day with full enrichment
    setState(prev => ({
      ...prev,
      step: 'enriching',
      progress: 10,
      message: `Enriching Day 1 of ${params.totalDays}...`,
    }));

    const enrichedDays: any[] = [];
    const previousActivities: string[] = [];

    for (let dayNum = 1; dayNum <= params.totalDays; dayNum++) {
      const dayProgress = 10 + ((dayNum - 1) / params.totalDays) * 80;
      setState(prev => ({
        ...prev,
        currentDay: dayNum,
        progress: dayProgress,
        message: `Enriching Day ${dayNum} of ${params.totalDays}...`,
      }));

      try {
        const dateObj = new Date(params.startDate);
        dateObj.setDate(dateObj.getDate() + dayNum - 1);
        const dateStr = dateObj.toISOString().split('T')[0];

        const { data, error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'generate-day',
            tripId: params.tripId,
            dayNumber: dayNum,
            totalDays: params.totalDays,
            destination: params.destination,
            destinationCountry: params.destinationCountry,
            date: dateStr,
            travelers: params.travelers,
            tripType: params.tripType,
            budgetTier: params.budgetTier,
            previousDayActivities: previousActivities.slice(-10),
          },
        });

        if (error) throw error;
        if (!data?.success && !data?.day) {
          throw new Error(data?.error || `Failed to enrich day ${dayNum}`);
        }

        const dayData = data.day || data;
        enrichedDays.push(dayData);

        // Track activities to prevent duplicates
        const activities = dayData.activities || dayData.timeBlocks || [];
        activities.forEach((a: any) => {
          if (a.title || a.name) previousActivities.push(a.title || a.name);
        });
      } catch (err: any) {
        console.error(`[UnlockTrip] Day ${dayNum} enrichment failed:`, err);
        // Continue with remaining days - partial enrichment is better than none
        enrichedDays.push(null);
      }
    }

    // Step 3: Save enriched itinerary with isPreview = false
    setState(prev => ({
      ...prev,
      step: 'saving',
      progress: 92,
      message: 'Saving your unlocked itinerary...',
    }));

    try {
      const itineraryToSave = {
        days: enrichedDays.filter(Boolean),
        generatedAt: new Date().toISOString(),
        destination: params.destination,
        isPreview: false, // Clear preview flag
      };

      const { error: saveError } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          action: 'save-itinerary',
          tripId: params.tripId,
          itinerary: itineraryToSave,
        },
      });

      if (saveError) {
        console.error('[UnlockTrip] Save failed:', saveError);
        // Non-fatal — data is still available
      }

      setState({
        step: 'complete',
        progress: 100,
        currentDay: params.totalDays,
        totalDays: params.totalDays,
        message: 'Itinerary unlocked!',
        error: null,
      });

      toast.success('🎉 Itinerary unlocked! Full details are now available.');
      onComplete?.(itineraryToSave);
      return true;
    } catch (err: any) {
      console.error('[UnlockTrip] Save error:', err);
      setState(prev => ({
        ...prev,
        step: 'error',
        error: 'Failed to save enriched itinerary',
      }));
      return false;
    }
  }, [user, getUnlockCost, queryClient]);

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      progress: 0,
      currentDay: 0,
      totalDays: 0,
      message: '',
      error: null,
    });
  }, []);

  return {
    state,
    unlock,
    reset,
    getUnlockCost,
    canAfford,
    totalCredits,
    isUnlocking: state.step !== 'idle' && state.step !== 'complete' && state.step !== 'error',
  };
}
