/**
 * useBulkUnlock — Handles bulk day unlock via the group_unlock action
 * in the spend-credits edge function.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useCredits } from './useCredits';
import { useOutOfCredits } from '@/contexts/OutOfCreditsContext';
import { toast } from 'sonner';
import { getBulkUnlockCost } from '@/components/itinerary/BulkUnlockBanner';

interface BulkUnlockParams {
  tripId: string;
  lockedDayCount: number;
  totalDays: number;
  destination: string;
  destinationCountry?: string;
  travelers: number;
  startDate: string;
  budgetTier?: string;
  tripType?: string;
  /** Day numbers that are currently locked */
  lockedDayNumbers: number[];
}

export function useBulkUnlock() {
  const { user } = useAuth();
  const { data: creditData } = useCredits();
  const queryClient = useQueryClient();
  const { showOutOfCredits } = useOutOfCredits();
  const [isUnlocking, setIsUnlocking] = useState(false);

  const totalCredits = creditData?.totalCredits ?? 0;

  const bulkUnlock = useCallback(async (
    params: BulkUnlockParams,
    onComplete?: () => void,
  ) => {
    if (!user) {
      toast.error('Please sign in to unlock days');
      return false;
    }

    const cost = getBulkUnlockCost(params.lockedDayCount);

    if (totalCredits < cost) {
      showOutOfCredits({
        action: 'UNLOCK_DAY',
        creditsNeeded: cost,
        creditsAvailable: totalCredits,
        tripId: params.tripId,
      });
      return false;
    }

    setIsUnlocking(true);

    try {
      // Step 1: Spend credits via group_unlock action
      const { data: spendData, error: spendError } = await supabase.functions.invoke('spend-credits', {
        body: {
          action: 'group_unlock',
          tripId: params.tripId,
          creditsAmount: cost,
          metadata: {
            type: 'bulk_day_unlock',
            lockedDayCount: params.lockedDayCount,
            destination: params.destination,
          },
        },
      });

      if (spendError) throw new Error(spendError.message || 'Failed to spend credits');
      if (spendData?.error === 'Insufficient credits') {
        showOutOfCredits({
          action: 'UNLOCK_DAY',
          creditsNeeded: cost,
          creditsAvailable: spendData.available ?? totalCredits,
          tripId: params.tripId,
        });
        setIsUnlocking(false);
        return false;
      }
      if (spendData?.error) throw new Error(spendData.error);

      queryClient.invalidateQueries({ queryKey: ['credits', user.id] });

      // Step 2: Enrich each locked day sequentially
      for (const dayNumber of params.lockedDayNumbers) {
        try {
          const dateObj = parseLocalDate(params.startDate);
          dateObj.setDate(dateObj.getDate() + dayNumber - 1);
          const dateStr = dateObj.toISOString().split('T')[0];

          await supabase.functions.invoke('generate-itinerary', {
            body: {
              action: 'generate-day',
              tripId: params.tripId,
              dayNumber,
              totalDays: params.totalDays,
              destination: params.destination,
              destinationCountry: params.destinationCountry,
              date: dateStr,
              travelers: params.travelers,
              tripType: params.tripType,
              budgetTier: params.budgetTier,
            },
          });
        } catch (err) {
          console.error(`[BulkUnlock] Failed to enrich day ${dayNumber}:`, err);
        }
      }

      // Step 3: Update unlocked_day_count to total days
      try {
        await supabase
          .from('trips')
          .update({ unlocked_day_count: params.totalDays } as any)
          .eq('id', params.tripId);
      } catch (dbErr) {
        console.error('[BulkUnlock] Failed to update unlocked_day_count:', dbErr);
      }

      // Step 4: Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['trip', params.tripId] });
      queryClient.invalidateQueries({ queryKey: ['entitlements', user.id] });

      toast.success(`🎉 All ${params.lockedDayCount} days unlocked! Full details are now available.`);
      onComplete?.();
      return true;
    } catch (err: any) {
      console.error('[BulkUnlock] Failed:', err);
      toast.error('Failed to unlock days. Please try again.');
      return false;
    } finally {
      setIsUnlocking(false);
    }
  }, [user, totalCredits, queryClient, showOutOfCredits]);

  return {
    bulkUnlock,
    isUnlocking,
    totalCredits,
  };
}
