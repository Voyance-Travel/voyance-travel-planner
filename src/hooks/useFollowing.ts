import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FollowedCreator {
  creator_id: string;
  followed_at: string;
  display_name: string | null;
  avatar_url: string | null;
  handle: string | null;
  archetype: string | null;
  guides: {
    id: string;
    title: string;
    slug: string | null;
    destination: string | null;
    published_at: string | null;
  }[];
  total_guides: number;
}

export function useFollowing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['following', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<FollowedCreator[]> => {
      // Get all follows
      const { data: follows, error: followsErr } = await supabase
        .from('creator_follows')
        .select('creator_id, created_at')
        .eq('follower_id', user!.id)
        .order('created_at', { ascending: false });

      if (followsErr) throw followsErr;
      if (!follows || follows.length === 0) return [];

      const creatorIds = follows.map(f => f.creator_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, handle')
        .in('id', creatorIds);

      // Get travel DNA for archetype
      const { data: dnaProfiles } = await supabase
        .from('travel_dna_profiles')
        .select('user_id, primary_archetype_name')
        .in('user_id', creatorIds);

      // Get published guides (max 3 per creator for display)
      const { data: guides } = await supabase
        .from('community_guides')
        .select('id, title, slug, destination, published_at, user_id')
        .in('user_id', creatorIds)
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      // Group guides by creator
      const guidesByCreator = new Map<string, typeof guides>();
      for (const g of guides || []) {
        const list = guidesByCreator.get(g.user_id) || [];
        list.push(g);
        guidesByCreator.set(g.user_id, list);
      }

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const dnaMap = new Map((dnaProfiles || []).map(d => [d.user_id, d]));

      return follows.map(f => {
        const profile = profileMap.get(f.creator_id);
        const dna = dnaMap.get(f.creator_id);
        const creatorGuides = guidesByCreator.get(f.creator_id) || [];
        return {
          creator_id: f.creator_id,
          followed_at: f.created_at,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          handle: profile?.handle || null,
          archetype: dna?.primary_archetype_name || null,
          guides: creatorGuides.slice(0, 3).map(g => ({
            id: g.id,
            title: g.title,
            slug: g.slug,
            destination: g.destination,
            published_at: g.published_at,
          })),
          total_guides: creatorGuides.length,
        };
      });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      const { error } = await supabase
        .from('creator_follows')
        .delete()
        .eq('follower_id', user!.id)
        .eq('creator_id', creatorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following', user?.id] });
    },
  });

  return {
    following: query.data || [],
    isLoading: query.isLoading,
    unfollow: unfollowMutation.mutate,
    isUnfollowing: unfollowMutation.isPending,
  };
}
