/**
 * Hook for fetching user's credit balance
 * Credit-based pricing model - single currency for everything
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CreditBalance {
  id: string;
  user_id: string;
  purchased_credits: number;
  free_credits: number;
  free_credits_expires_at: string | null;
  last_free_credit_earned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditData {
  balance: CreditBalance | null;
  totalCredits: number;
  purchasedCredits: number;
  freeCredits: number;
  effectiveFreeCredits: number;
  freeCreditsExpired: boolean;
}

async function fetchCredits(userId: string | undefined): Promise<CreditData> {
  if (!userId) {
    return {
      balance: null,
      totalCredits: 0,
      purchasedCredits: 0,
      freeCredits: 0,
      effectiveFreeCredits: 0,
      freeCreditsExpired: false,
    };
  }

  // For now, use the existing user_credits table
  // TODO: Create dedicated credit_balances table with the new schema
  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[useCredits] Error fetching credits:', error);
    throw error;
  }

  if (!data) {
    return {
      balance: null,
      totalCredits: 0,
      purchasedCredits: 0,
      freeCredits: 0,
      effectiveFreeCredits: 0,
      freeCreditsExpired: false,
    };
  }

  // Map from user_credits to credit format
  // balance_cents is now credits (1 cent = 1 credit for migration purposes)
  const purchasedCredits = data.balance_cents || 0;
  const freeCredits = 0; // Will be tracked separately later
  
  return {
    balance: {
      id: data.user_id, // user_credits uses user_id as key
      user_id: userId,
      purchased_credits: purchasedCredits,
      free_credits: freeCredits,
      free_credits_expires_at: null,
      last_free_credit_earned_at: null,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
    },
    totalCredits: purchasedCredits + freeCredits,
    purchasedCredits,
    freeCredits,
    effectiveFreeCredits: freeCredits,
    freeCreditsExpired: false,
  };
}

export function useCredits() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['credits', user?.id],
    queryFn: () => fetchCredits(user?.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });
}

export function useRefreshCredits() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
    }
  };
}

export default useCredits;
