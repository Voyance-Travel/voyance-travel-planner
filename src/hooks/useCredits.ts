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
  last_free_credit_at: string | null;
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

  // Fetch from the new credit_balances table
  const { data, error } = await supabase
    .from('credit_balances')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[useCredits] Error fetching credits:', error);
    throw error;
  }

  if (!data) {
    // No balance record yet - user has 0 credits
    return {
      balance: null,
      totalCredits: 0,
      purchasedCredits: 0,
      freeCredits: 0,
      effectiveFreeCredits: 0,
      freeCreditsExpired: false,
    };
  }

  const purchasedCredits = data.purchased_credits || 0;
  let freeCredits = data.free_credits || 0;
  let freeCreditsExpired = false;
  
  // Check if free credits are expired
  if (data.free_credits_expires_at) {
    const expiresAt = new Date(data.free_credits_expires_at);
    if (expiresAt < new Date()) {
      freeCreditsExpired = true;
      freeCredits = 0; // Don't count expired free credits
    }
  }

  const effectiveFreeCredits = freeCreditsExpired ? 0 : freeCredits;
  const totalCredits = purchasedCredits + effectiveFreeCredits;
  
  return {
    balance: {
      id: data.id,
      user_id: data.user_id,
      purchased_credits: purchasedCredits,
      free_credits: data.free_credits || 0,
      free_credits_expires_at: data.free_credits_expires_at,
      last_free_credit_at: data.last_free_credit_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
    totalCredits,
    purchasedCredits,
    freeCredits: data.free_credits || 0,
    effectiveFreeCredits,
    freeCreditsExpired,
  };
}

export function useCredits() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['credits', user?.id],
    queryFn: () => fetchCredits(user?.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
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
