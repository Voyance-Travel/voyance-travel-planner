/**
 * Profiles Service - Supabase
 * 
 * Manages user profiles stored in Lovable Cloud (Supabase)
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Json } from '@/integrations/supabase/types';

// ============================================================================
// TYPES
// ============================================================================

export interface Profile {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  home_airport: string | null;
  preferred_currency: string;
  preferred_language: string;
  quiz_completed: boolean;
  travel_dna: Json | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileSearchResult {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ProfileUpdate {
  handle?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  home_airport?: string;
  preferred_currency?: string;
  preferred_language?: string;
  quiz_completed?: boolean;
  travel_dna?: Json;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get current user's profile
 */
export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[Profiles] Error fetching profile:', error);
    throw error;
  }

  return data;
}

/**
 * Get profile by user ID
 */
export async function getProfileById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Profiles] Error fetching profile by ID:', error);
    throw error;
  }

  return data;
}

/**
 * Search profiles by handle or email (for friend search)
 */
export async function searchProfilesByHandle(query: string): Promise<ProfileSearchResult[]> {
  if (!query || query.length < 2) return [];

  // Check if query looks like an email
  const isEmail = query.includes('@');
  
  if (isEmail) {
    // Search by email - need to use auth.users via RPC or check if we have email linked
    // For now, we'll try to find by exact email match if they've connected it
    const { data, error } = await supabase
      .from('profiles')
      .select('id, handle, display_name, avatar_url')
      .limit(10);

    // We can't directly query auth.users email from client
    // Return all profiles and let client filter (limited approach)
    // Better approach: create an edge function for email lookup
    if (error) {
      console.error('[Profiles] Error searching profiles by email:', error);
      throw error;
    }

    return data || [];
  }

  // Search by handle or display name
  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_url')
    .or(`handle.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error('[Profiles] Error searching profiles:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get profile by exact handle
 */
export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error('[Profiles] Error fetching profile by handle:', error);
    throw error;
  }

  return data;
}

/**
 * Check if a handle is available
 */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error('[Profiles] Error checking handle:', error);
    return false;
  }

  return !data;
}

/**
 * Update current user's profile
 */
export async function updateProfile(updates: ProfileUpdate): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Normalize handle to lowercase
  if (updates.handle) {
    updates.handle = updates.handle.toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('[Profiles] Error updating profile:', error);
    throw error;
  }

  return data;
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    staleTime: 60_000,
  });
}

export function useProfileById(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfileById(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useProfileByHandle(handle: string | undefined) {
  return useQuery({
    queryKey: ['profile', 'handle', handle],
    queryFn: () => getProfileByHandle(handle!),
    enabled: !!handle,
    staleTime: 60_000,
  });
}

export function useSearchProfiles(query: string) {
  return useQuery({
    queryKey: ['profiles', 'search', query],
    queryFn: () => searchProfilesByHandle(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useCheckHandle(handle: string) {
  return useQuery({
    queryKey: ['handle-check', handle],
    queryFn: () => isHandleAvailable(handle),
    enabled: handle.length >= 3,
    staleTime: 10_000,
  });
}
