import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DestinationData {
  city: string;
  country: string;
  region?: string;
  tagline?: string;
  imageUrl?: string;
}

export function useIsSaved(itemId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['is-saved', user?.id, itemId],
    queryFn: async () => {
      if (!user?.id) return false;
      const { count } = await supabase
        .from('saved_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('item_type', 'destination')
        .eq('item_id', itemId);
      return (count ?? 0) > 0;
    },
    enabled: !!user?.id && !!itemId,
    staleTime: 60_000,
  });
}

export function useToggleSaveDestination() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: DestinationData }) => {
      if (!isAuthenticated || !user?.id) {
        throw new Error('auth_required');
      }

      // Check if already saved
      const { data: existing } = await supabase
        .from('saved_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_type', 'destination')
        .eq('item_id', itemId)
        .maybeSingle();

      if (existing) {
        // Remove
        const { error } = await supabase
          .from('saved_items')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        return { saved: false, city: data.city };
      } else {
        // Add
        const { error } = await supabase
          .from('saved_items')
          .insert({
            user_id: user.id,
            item_type: 'destination',
            item_id: itemId,
            item_data: data as any,
          });
        if (error) throw error;
        return { saved: true, city: data.city };
      }
    },
    onSuccess: (result) => {
      toast.success(result.saved ? `${result.city} added to favorites` : `${result.city} removed from favorites`);
      queryClient.invalidateQueries({ queryKey: ['is-saved'] });
      queryClient.invalidateQueries({ queryKey: ['saved-destinations'] });
    },
    onError: (err: Error) => {
      if (err.message === 'auth_required') {
        toast.error('Sign in to save favorites');
      } else {
        toast.error('Failed to update favorite');
      }
    },
  });
}
