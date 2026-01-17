/**
 * Users Search API Service
 * Endpoints for searching users by name, username, or email
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

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
// API HELPERS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Search users by name, username, or email
 * Requires at least 2 characters in query
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }
  
  const headers = await getAuthHeader();
  
  const response = await fetch(
    `${BACKEND_URL}/api/v1/users/search?q=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers,
    }
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to search users: ${response.statusText}`);
  }
  
  const data: UsersSearchResponse = await response.json();
  return data.results;
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
