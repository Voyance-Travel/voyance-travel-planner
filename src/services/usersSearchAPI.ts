/**
 * Users Search API Service
 * 
 * Search users by name or handle - now using Supabase directly.
 * Uses profiles table for search functionality.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface UserSearchResult {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar?: string;
}

export interface UsersSearchResponse {
  results: UserSearchResult[];
}

// ============================================================================
// API FUNCTIONS - Using Supabase profiles table
// ============================================================================

/**
 * Search users by name or handle
 * Requires at least 2 characters in query
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const searchPattern = `%${query}%`;

  // Search by display_name or handle
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, handle, avatar_url')
    .or(`display_name.ilike.${searchPattern},handle.ilike.${searchPattern}`)
    .limit(20);

  if (error) {
    console.error('[UsersSearchAPI] Search error:', error);
    throw new Error(error.message);
  }

  // Mutual hide: drop any user who is in a 'blocked' friendship with the
  // current user (regardless of which side initiated the block). Blocking
  // is modeled via friendships.status='blocked' (no dedicated user_blocks table).
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const blockedUserIds = new Set<string>();
  if (currentUser) {
    const { data: blocks } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'blocked')
      .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);

    for (const b of blocks || []) {
      if (b.requester_id !== currentUser.id) blockedUserIds.add(b.requester_id);
      if (b.addressee_id !== currentUser.id) blockedUserIds.add(b.addressee_id);
    }
  }

  return (data || [])
    .filter(profile => !blockedUserIds.has(profile.id))
    .map(profile => ({
      id: profile.id,
      name: profile.display_name || 'User',
      username: profile.handle || '',
      email: '', // Email not exposed for privacy
      avatar: profile.avatar_url || undefined,
    }));
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook to search users with debounced query
 */
export function useUsersSearch(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['users-search', query],
    queryFn: () => searchUsers(query),
    enabled: enabled && query.length >= 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export default {
  searchUsers,
};
