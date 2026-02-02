/**
 * Hook for fetching user's day balance from the day_balances table
 * Part of the new day-based pricing model
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DayBalance {
  id: string;
  user_id: string;
  purchased_days: number;
  free_days: number;
  free_days_expires_at: string | null;
  active_tier: string | null; // 'essential' | 'complete' | null
  swaps_remaining: number | null;
  regenerates_remaining: number | null;
  monthly_swaps_used: number;
  monthly_regenerates_used: number;
  monthly_reset_at: string;
  last_free_day_earned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DayBalanceData {
  balance: DayBalance | null;
  totalDays: number;
  hasActiveTier: boolean;
  isComplete: boolean;
  isEssential: boolean;
  freeDaysExpired: boolean;
  effectiveFreeDays: number;
}

async function fetchDayBalance(userId: string | undefined): Promise<DayBalanceData> {
  if (!userId) {
    return {
      balance: null,
      totalDays: 0,
      hasActiveTier: false,
      isComplete: false,
      isEssential: false,
      freeDaysExpired: false,
      effectiveFreeDays: 0,
    };
  }

  const { data, error } = await supabase
    .from('day_balances')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[useDayBalance] Error fetching day balance:', error);
    throw error;
  }

  if (!data) {
    return {
      balance: null,
      totalDays: 0,
      hasActiveTier: false,
      isComplete: false,
      isEssential: false,
      freeDaysExpired: false,
      effectiveFreeDays: 0,
    };
  }

  const balance = data as DayBalance;
  const now = new Date();
  const expiresAt = balance.free_days_expires_at ? new Date(balance.free_days_expires_at) : null;
  const freeDaysExpired = expiresAt ? now > expiresAt : false;
  const effectiveFreeDays = freeDaysExpired ? 0 : balance.free_days;

  return {
    balance,
    totalDays: balance.purchased_days + effectiveFreeDays,
    hasActiveTier: balance.active_tier !== null,
    isComplete: balance.active_tier === 'complete',
    isEssential: balance.active_tier === 'essential',
    freeDaysExpired,
    effectiveFreeDays,
  };
}

export function useDayBalance() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['day-balance', user?.id],
    queryFn: () => fetchDayBalance(user?.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });
}

export function useRefreshDayBalance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['day-balance', user.id] });
    }
  };
}

export default useDayBalance;
