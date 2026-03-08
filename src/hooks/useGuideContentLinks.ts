import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchGuideContentLinks, type GuideContentLink } from '@/services/guideContentLinksAPI';

export interface ContentLinkInput {
  platform: string;
  url: string;
  title: string;
  description?: string;
  day_number?: number | null;
  activity_id?: string | null;
  activity_name?: string | null;
}

export function useGuideContentLinks(guideId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const qk = ['guide-content-links', guideId];

  const query = useQuery({
    queryKey: qk,
    enabled: !!guideId,
    queryFn: () => fetchGuideContentLinks(guideId!),
  });

  const addMutation = useMutation({
    mutationFn: async (input: ContentLinkInput) => {
      if (!guideId || !user) throw new Error('Missing guide or user');
      const maxSort = (query.data || []).reduce((m, l) => Math.max(m, l.sort_order), 0);
      const { error } = await supabase.from('guide_content_links').insert({
        guide_id: guideId,
        user_id: user.id,
        platform: input.platform,
        url: input.url,
        title: input.title,
        description: input.description || null,
        day_number: input.day_number ?? null,
        activity_id: input.activity_id ?? null,
        activity_name: input.activity_name ?? null,
        sort_order: maxSort + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<ContentLinkInput> & { id: string }) => {
      const { error } = await supabase.from('guide_content_links').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('guide_content_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  return {
    contentLinks: query.data || [],
    isLoading: query.isLoading,
    addLink: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    updateLink: updateMutation.mutateAsync,
    deleteLink: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
