import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export interface SavedDestination {
  id: string;
  item_id: string;
  city: string;
  country: string;
  region?: string;
  tagline?: string;
  imageUrl?: string;
  created_at: string;
}

export function useSavedDestinations() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return useQuery({
    queryKey: ['saved-destinations', userId],
    queryFn: async (): Promise<SavedDestination[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('saved_items')
        .select('*')
        .eq('user_id', userId)
        .eq('item_type', 'destination')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((item) => {
        const d = item.item_data as Record<string, unknown> | null;
        return {
          id: item.id,
          item_id: item.item_id,
          city: (d?.city as string) || item.item_id,
          country: (d?.country as string) || '',
          region: (d?.region as string) || undefined,
          tagline: (d?.tagline as string) || undefined,
          imageUrl: (d?.imageUrl as string) || undefined,
          created_at: item.created_at,
        };
      });
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useRemoveSavedDestination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (savedItemId: string) => {
      const { error } = await supabase
        .from('saved_items')
        .delete()
        .eq('id', savedItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-destinations'] });
    },
  });
}
