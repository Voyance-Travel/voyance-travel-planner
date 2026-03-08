import { supabase } from '@/integrations/supabase/client';

export async function followCreator(creatorId: string, followerId: string) {
  const { error } = await supabase
    .from('creator_follows')
    .insert({ follower_id: followerId, creator_id: creatorId });
  if (error) throw error;
}

export async function unfollowCreator(creatorId: string, followerId: string) {
  const { error } = await supabase
    .from('creator_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('creator_id', creatorId);
  if (error) throw error;
}

export async function isFollowing(creatorId: string, followerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('creator_follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('creator_id', creatorId)
    .maybeSingle();
  return !!data;
}

export async function getFollowerCount(creatorId: string): Promise<number> {
  const { count, error } = await supabase
    .from('creator_follows')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  if (error) return 0;
  return count || 0;
}
