/**
 * Trip Collaborators Service
 * 
 * Manages linking friends to specific trips for collaborative itinerary generation
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Profile } from '@/services/supabase/profiles';

// ============================================================================
// TYPES
// ============================================================================

export interface TripCollaborator {
  id: string;
  trip_id: string;
  user_id: string;
  permission: 'viewer' | 'editor' | 'contributor';
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
  profile?: Pick<Profile, 'id' | 'handle' | 'display_name' | 'avatar_url'>;
}

export interface AddCollaboratorRequest {
  tripId: string;
  userId: string;
  permission?: 'viewer' | 'editor' | 'contributor';
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get collaborators for a trip
 */
export async function getTripCollaborators(tripId: string): Promise<TripCollaborator[]> {
  const { data, error } = await supabase
    .from('trip_collaborators')
    .select(`
      id,
      trip_id,
      user_id,
      permission,
      invited_by,
      accepted_at,
      created_at,
      profile:profiles!trip_collaborators_user_id_fkey(id, handle, display_name, avatar_url)
    `)
    .eq('trip_id', tripId);

  if (error) {
    console.error('[TripCollaborators] Error fetching:', error);
    throw error;
  }

  return (data || []).map(c => ({
    ...c,
    permission: c.permission as 'viewer' | 'editor' | 'contributor',
    profile: c.profile as unknown as Pick<Profile, 'id' | 'handle' | 'display_name' | 'avatar_url'>,
  }));
}

/**
 * Add a collaborator to a trip
 */
export async function addTripCollaborator({ tripId, userId, permission = 'contributor' }: AddCollaboratorRequest): Promise<TripCollaborator> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if already a collaborator
  const { data: existing } = await supabase
    .from('trip_collaborators')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    throw new Error('Already a collaborator on this trip');
  }

  const { data, error } = await supabase
    .from('trip_collaborators')
    .insert({
      trip_id: tripId,
      user_id: userId,
      permission,
      invited_by: user.id,
      accepted_at: new Date().toISOString(), // Auto-accept for friends
    })
    .select(`
      id,
      trip_id,
      user_id,
      permission,
      invited_by,
      accepted_at,
      created_at,
      profile:profiles!trip_collaborators_user_id_fkey(id, handle, display_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error('[TripCollaborators] Error adding:', error);
    throw error;
  }

  return {
    ...data,
    permission: data.permission as 'viewer' | 'editor' | 'contributor',
    profile: data.profile as unknown as Pick<Profile, 'id' | 'handle' | 'display_name' | 'avatar_url'>,
  };
}

/**
 * Remove a collaborator from a trip
 */
export async function removeTripCollaborator(collaboratorId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_collaborators')
    .delete()
    .eq('id', collaboratorId);

  if (error) {
    console.error('[TripCollaborators] Error removing:', error);
    throw error;
  }
}

/**
 * Get all trips where user is a collaborator
 */
export async function getCollaboratorTrips(): Promise<{ tripId: string; tripName: string; permission: string }[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('trip_collaborators')
    .select(`
      trip_id,
      permission,
      trip:trips!trip_collaborators_trip_id_fkey(id, name)
    `)
    .eq('user_id', user.id);

  if (error) {
    console.error('[TripCollaborators] Error fetching trips:', error);
    return [];
  }

  return (data || []).map(c => ({
    tripId: c.trip_id,
    tripName: (c.trip as any)?.name || 'Unknown Trip',
    permission: c.permission,
  }));
}

/**
 * Get collaborator preferences for itinerary generation
 */
export async function getCollaboratorPreferences(tripId: string): Promise<any[]> {
  const collaborators = await getTripCollaborators(tripId);
  
  if (collaborators.length === 0) return [];

  const userIds = collaborators.map(c => c.user_id);
  
  const { data: preferences, error } = await supabase
    .from('user_preferences')
    .select('*')
    .in('user_id', userIds);

  if (error) {
    console.error('[TripCollaborators] Error fetching preferences:', error);
    return [];
  }

  return preferences || [];
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useTripCollaborators(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip-collaborators', tripId],
    queryFn: () => getTripCollaborators(tripId!),
    enabled: !!tripId,
    staleTime: 60_000,
  });
}

export function useAddTripCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addTripCollaborator,
    onSuccess: (_, variables) => {
      toast.success('Friend linked to trip!');
      queryClient.invalidateQueries({ queryKey: ['trip-collaborators', variables.tripId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add collaborator');
    },
  });
}

export function useRemoveTripCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeTripCollaborator,
    onSuccess: () => {
      toast.success('Collaborator removed');
      queryClient.invalidateQueries({ queryKey: ['trip-collaborators'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove collaborator');
    },
  });
}

export function useCollaboratorTrips() {
  return useQuery({
    queryKey: ['collaborator-trips'],
    queryFn: getCollaboratorTrips,
    staleTime: 60_000,
  });
}
