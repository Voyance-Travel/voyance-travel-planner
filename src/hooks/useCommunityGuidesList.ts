import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CommunityGuideListItem {
  id: string;
  title: string;
  description: string | null;
  destination: string | null;
  destination_country: string | null;
  cover_image_url: string | null;
  slug: string | null;
  content: Record<string, any> | null;
  tags: string[];
  view_count: number;
  like_count: number;
  published_at: string | null;
  user_id: string;
  // Joined creator info
  creator_name: string | null;
  creator_avatar: string | null;
  creator_archetype: string | null;
}

export function useCommunityGuidesList(limit = 30) {
  return useQuery({
    queryKey: ['community-guides-list', limit],
    queryFn: async (): Promise<CommunityGuideListItem[]> => {
      const { data: guides, error } = await supabase
        .from('community_guides')
        .select('id, title, description, destination, destination_country, cover_image_url, slug, content, tags, view_count, like_count, published_at, user_id')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!guides || guides.length === 0) return [];

      const userIds = [...new Set(guides.map(g => g.user_id))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const { data: dnaProfiles } = await (supabase.from('travel_dna_profiles') as any)
        .select('user_id, primary_archetype_name')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const dnaMap = new Map(((dnaProfiles as any[]) || []).map((d: any) => [d.user_id, d]));

      return guides.map(g => {
        const profile = profileMap.get(g.user_id);
        const dna = dnaMap.get(g.user_id);
        return {
          ...g,
          tags: (g.tags || []) as string[],
          content: g.content as Record<string, any> | null,
          creator_name: profile?.display_name || null,
          creator_avatar: profile?.avatar_url || null,
          creator_archetype: dna?.primary_archetype_name || null,
        };
      });
    },
    staleTime: 60_000,
  });
}
