import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserCredits {
  balance_cents: number;
  last_topup_at: string | null;
}

export function useUserCredits() {
  return useQuery({
    queryKey: ['user-credits'],
    queryFn: async (): Promise<UserCredits> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { balance_cents: 0, last_topup_at: null };
      }

      const { data, error } = await supabase
        .from('user_credits')
        .select('balance_cents, updated_at')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching credits:', error);
      }

      return {
        balance_cents: data?.balance_cents ?? 0,
        last_topup_at: data?.updated_at ?? null,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function formatCredits(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function hasEnoughCredits(balance: number, required: number): boolean {
  return balance >= required;
}
