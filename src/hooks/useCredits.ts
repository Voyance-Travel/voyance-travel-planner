/**
 * Hook for fetching user's credit balance
 * Now includes credit_purchases breakdown for FIFO expiration display
 * Fix #12: Includes new-user loading state to avoid showing "0 credits" during onboarding
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CreditPurchase {
  id: string;
  credit_type: string;
  amount: number;
  remaining: number;
  expires_at: string | null;
  club_tier: string | null;
  created_at: string;
}

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
  purchases: CreditPurchase[];
  /** True while a new user's welcome credits haven't arrived yet */
  isNewUserLoading: boolean;
  /** True if polling timed out without credits appearing */
  newUserTimedOut: boolean;
}

async function fetchCredits(userId: string | undefined): Promise<Omit<CreditData, 'isNewUserLoading' | 'newUserTimedOut'>> {
  const empty = {
    balance: null, totalCredits: 0, purchasedCredits: 0,
    freeCredits: 0, effectiveFreeCredits: 0, freeCreditsExpired: false, purchases: [],
  };

  if (!userId) return empty;

  // Fetch balance cache and active purchases in parallel
  const [balanceRes, purchasesRes] = await Promise.all([
    supabase.from('credit_balances').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('credit_purchases').select('id, credit_type, amount, remaining, expires_at, club_tier, created_at')
      .eq('user_id', userId).gt('remaining', 0).order('expires_at', { ascending: true, nullsFirst: false }),
  ]);

  if (balanceRes.error) { console.error('[useCredits] Error:', balanceRes.error); throw balanceRes.error; }

  const data = balanceRes.data;
  const now = new Date();

  // Filter active (non-expired) purchases
  const activePurchases = (purchasesRes.data || []).filter(
    p => !p.expires_at || new Date(p.expires_at) > now
  );

  if (!data) return { ...empty, purchases: activePurchases };

  const purchasedCredits = data.purchased_credits || 0;
  let freeCredits = data.free_credits || 0;
  let freeCreditsExpired = false;

  if (data.free_credits_expires_at) {
    if (new Date(data.free_credits_expires_at) < now) {
      freeCreditsExpired = true;
      freeCredits = 0;
    }
  }

  const effectiveFreeCredits = freeCreditsExpired ? 0 : freeCredits;
  const totalCredits = purchasedCredits + effectiveFreeCredits;

  return {
    balance: {
      id: data.id, user_id: data.user_id,
      purchased_credits: purchasedCredits, free_credits: data.free_credits || 0,
      free_credits_expires_at: data.free_credits_expires_at,
      last_free_credit_at: data.last_free_credit_at,
      created_at: data.created_at, updated_at: data.updated_at,
    },
    totalCredits, purchasedCredits, freeCredits: data.free_credits || 0,
    effectiveFreeCredits, freeCreditsExpired, purchases: activePurchases,
  };
}

export function useCredits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const retryCount = useRef(0);
  const [newUserTimedOut, setNewUserTimedOut] = useState(false);

  // Detect if user account was created within the last 60 seconds
  const isNewUser = useMemo(() => {
    if (!user?.createdAt) return false;
    const age = Date.now() - new Date(user.createdAt).getTime();
    return age < 60_000;
  }, [user?.createdAt]);

  const query = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: () => fetchCredits(user?.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // Fix #12: Poll for credits if new user has 0 credits
  const shouldPoll = isNewUser && query.data?.totalCredits === 0 && query.data?.purchases?.length === 0 && retryCount.current < 10 && !newUserTimedOut;

  useEffect(() => {
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      retryCount.current += 1;
      if (retryCount.current >= 10) {
        setNewUserTimedOut(true);
        clearInterval(interval);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['credits', user?.id] });
    }, 2000);

    return () => clearInterval(interval);
  }, [shouldPoll, queryClient, user?.id]);

  // Augment query data with new-user loading flags
  const augmentedData: CreditData | undefined = query.data ? {
    ...query.data,
    isNewUserLoading: shouldPoll,
    newUserTimedOut: newUserTimedOut && query.data.totalCredits === 0,
  } : undefined;

  return {
    ...query,
    data: augmentedData,
  };
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
