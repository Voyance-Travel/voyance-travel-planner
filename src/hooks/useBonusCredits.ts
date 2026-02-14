/**
 * Hook for granting and tracking credit bonuses
 * Handles: welcome, launch, quiz_completion, preferences_completion, first_share, second_itinerary
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SIGNUP_CREDITS } from '@/config/pricing';

export type BonusType = 
  | 'welcome'
  | 'launch'
  | 'quiz_completion'
  | 'preferences_completion'
  | 'first_share'
  | 'second_itinerary';

export interface BonusClaim {
  id: string;
  bonus_type: BonusType;
  credits_granted: number;
  granted_at: string;
  expires_at: string | null;
}

export interface GrantResult {
  granted: boolean;
  bonusType?: BonusType;
  credits?: number;
  description?: string;
  reason?: string;
  newBalance?: {
    free: number;
    purchased: number;
    total: number;
  };
}

// GUARD: Credit amounts sourced from SIGNUP_CREDITS in pricing.ts.
// Do NOT hardcode bonus amounts here — use the constants.
export const BONUS_INFO: Record<BonusType, {
  title: string;
  description: string;
  credits: number;
  icon: string;
}> = {
  welcome: {
    title: 'Welcome Bonus',
    credits: SIGNUP_CREDITS.welcomeBonus,
    description: 'Thanks for joining Voyance!',
    icon: '🎉',
  },
  launch: {
    title: 'Early Adopter Bonus',
    credits: SIGNUP_CREDITS.earlyAdopterBonus,
    description: 'Thank you for being part of our launch!',
    icon: '🚀',
  },
  quiz_completion: {
    title: 'Quiz Complete',
    credits: 100,
    description: 'Your Travel DNA has been revealed!',
    icon: '🧬',
  },
  preferences_completion: {
    title: 'Preferences Set',
    credits: 50,
    description: 'Your travel style is now personalized!',
    icon: '⚙️',
  },
  first_share: {
    title: 'First Share',
    credits: 50,
    description: 'Thanks for spreading the word!',
    icon: '📤',
  },
  second_itinerary: {
    title: 'Second Trip',
    credits: 50,
    description: 'You\'re becoming a travel pro!',
    icon: '✈️',
  },
};

// Fetch claimed bonuses
async function fetchClaimedBonuses(userId: string): Promise<BonusClaim[]> {
  const { data, error } = await supabase
    .from('user_credit_bonuses')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('[useBonusCredits] Error fetching bonuses:', error);
    return [];
  }

  return data as BonusClaim[];
}

// Grant a bonus
async function grantBonus(bonusType: BonusType, metadata?: Record<string, unknown>): Promise<GrantResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('grant-bonus-credits', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: { bonusType, metadata },
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data as GrantResult;
}

export function useBonusCredits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query for claimed bonuses
  const { data: claimedBonuses = [], isLoading } = useQuery({
    queryKey: ['bonus-credits', user?.id],
    queryFn: () => fetchClaimedBonuses(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
  });

  // Mutation for granting bonuses
  const grantMutation = useMutation({
    mutationFn: ({ bonusType, metadata }: { bonusType: BonusType; metadata?: Record<string, unknown> }) =>
      grantBonus(bonusType, metadata),
    onSuccess: (result) => {
      if (result.granted) {
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['bonus-credits', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['credits', user?.id] });
      }
    },
  });

  // Check if a bonus has been claimed
  const hasClaimedBonus = useCallback(
    (bonusType: BonusType): boolean => {
      return claimedBonuses.some(b => b.bonus_type === bonusType);
    },
    [claimedBonuses]
  );

  // Get unclaimed bonuses that could be shown as nudges
  const unclaimedBonuses = useCallback((): BonusType[] => {
    const claimed = new Set(claimedBonuses.map(b => b.bonus_type));
    return (Object.keys(BONUS_INFO) as BonusType[]).filter(type => !claimed.has(type));
  }, [claimedBonuses]);

  // Grant a specific bonus
  const claimBonus = useCallback(
    async (bonusType: BonusType, metadata?: Record<string, unknown>): Promise<GrantResult> => {
      if (hasClaimedBonus(bonusType)) {
        return { granted: false, reason: 'Already claimed' };
      }
      return grantMutation.mutateAsync({ bonusType, metadata });
    },
    [hasClaimedBonus, grantMutation]
  );

  // Grant welcome + launch bonuses together (for new signups)
  const claimWelcomeBonuses = useCallback(async (): Promise<GrantResult[]> => {
    const results: GrantResult[] = [];
    
    // Welcome bonus
    if (!hasClaimedBonus('welcome')) {
      const welcomeResult = await claimBonus('welcome');
      results.push(welcomeResult);
    }
    
    // Launch bonus (will fail gracefully if outside launch period)
    if (!hasClaimedBonus('launch')) {
      try {
        const launchResult = await claimBonus('launch');
        results.push(launchResult);
      } catch (e) {
        console.log('[useBonusCredits] Launch bonus not available');
      }
    }
    
    return results;
  }, [hasClaimedBonus, claimBonus]);

  return {
    claimedBonuses,
    isLoading,
    hasClaimedBonus,
    unclaimedBonuses,
    claimBonus,
    claimWelcomeBonuses,
    isGranting: grantMutation.isPending,
  };
}

export default useBonusCredits;
