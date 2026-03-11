/**
 * Hook to manage save/bookmark state for a community guide.
 * Optimistic toggle with auth check.
 */
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useSavedGuide(guideId: string | undefined) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  const { data: isSaved = false } = useQuery({
    queryKey: ['saved-guide', guideId, userId],
    queryFn: async () => {
      if (!guideId || !userId) return false;
      const { count } = await (supabase as any)
        .from('saved_guides')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('guide_id', guideId);
      return (count ?? 0) > 0;
    },
    enabled: !!guideId && !!userId,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!guideId || !userId) throw new Error('Not authenticated');
      if (isSaved) {
        const { error } = await (supabase as any)
          .from('saved_guides')
          .delete()
          .eq('user_id', userId)
          .eq('guide_id', guideId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('saved_guides')
          .insert({ user_id: userId, guide_id: guideId });
        if (error) throw error;
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['saved-guide', guideId, userId] });
      const prev = queryClient.getQueryData(['saved-guide', guideId, userId]);
      queryClient.setQueryData(['saved-guide', guideId, userId], !isSaved);
      return { prev };
    },
    onError: (_err: any, _vars: any, context: any) => {
      queryClient.setQueryData(['saved-guide', guideId, userId], context?.prev);
      toast.error('Failed to update bookmark');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-guide', guideId, userId] });
    },
  });

  const toggleSave = useCallback(() => {
    if (!userId) {
      toast.info('Sign in to save guides');
      return;
    }
    saveMutation.mutate(undefined);
  }, [userId, saveMutation]);

  return { isSaved, toggleSave, isLoggedIn: !!userId };
}
