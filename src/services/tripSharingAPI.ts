/**
 * Voyance Trip Sharing API
 * 
 * Trip sharing and collaboration - now using Supabase directly.
 * Uses trip_collaborators table for sharing functionality.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export type TravelerPermission = 'view' | 'edit' | 'full';

export interface TravelerProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  permissions: TravelerPermission[];
}

export interface GroupProfile {
  totalMembers: number;
  commonInterests: string[];
  budgetRange: { min: number; max: number };
  preferredPace: string;
}

export interface TravelersResponse {
  travelers: TravelerProfile[];
  groupProfile: GroupProfile;
  count: number;
}

export interface SavedActivity {
  id: string;
  activityId: string;
  destinationId: string;
  notes?: string;
  rating?: number;
  savedAt: string;
}

export interface GroupFavorite {
  activityId: string;
  activityName: string;
  voteCount: number;
  voters: string[];
  averageRating: number;
}

export interface SharedTrip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  ownerName: string;
  yourPermission: TravelerPermission;
  status: string;
}

// ============================================================================
// Traveler Management - Using Supabase trip_collaborators table
// ============================================================================

/**
 * Add travelers to a trip
 */
export async function addTravelers(
  tripId: string,
  travelerIds: string[],
  permissions: TravelerPermission = 'edit'
): Promise<{ success: boolean; added: string[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const inserts = travelerIds.map(userId => ({
    trip_id: tripId,
    user_id: userId,
    permission: permissions,
    invited_by: user.id,
  }));

  const { error } = await supabase
    .from('trip_collaborators')
    .insert(inserts);

  if (error) throw new Error(error.message);

  return { success: true, added: travelerIds };
}

/**
 * Get travelers for a trip
 */
export async function getTravelers(tripId: string): Promise<TravelersResponse> {
  const { data: collaborators, error } = await supabase
    .from('trip_collaborators')
    .select(`
      id,
      user_id,
      permission,
      accepted_at,
      profiles:user_id (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq('trip_id', tripId);

  if (error) throw new Error(error.message);

  // Also get trip owner
  const tripQuery = supabase
    .from('trips')
    .select('user_id, profiles:user_id (id, display_name, avatar_url)');
  const { data: trip } = (await (tripQuery as any)
    .eq('id', tripId)
    .single()) as { data: any };

  const travelers: TravelerProfile[] = [];

  // Add owner first
  if (trip?.profiles) {
    const ownerProfile = trip.profiles as unknown as { id: string; display_name: string; avatar_url: string };
    travelers.push({
      id: ownerProfile.id,
      email: '',
      displayName: ownerProfile.display_name || 'Trip Owner',
      avatarUrl: ownerProfile.avatar_url,
      role: 'owner',
      permissions: ['view', 'edit', 'full'],
    });
  }

  // Add collaborators
  for (const collab of collaborators || []) {
    const profile = collab.profiles as unknown as { id: string; display_name: string; avatar_url: string } | null;
    if (profile) {
      travelers.push({
        id: profile.id,
        email: '',
        displayName: profile.display_name || 'Traveler',
        avatarUrl: profile.avatar_url,
        role: 'collaborator',
        permissions: [collab.permission as TravelerPermission],
      });
    }
  }

  return {
    travelers,
    groupProfile: {
      totalMembers: travelers.length,
      commonInterests: [],
      budgetRange: { min: 0, max: 5000 },
      preferredPace: 'moderate',
    },
    count: travelers.length,
  };
}

/**
 * Remove a traveler from a trip
 */
export async function removeTraveler(
  tripId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from('trip_collaborators')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  return { success: true, message: 'Traveler removed' };
}

/**
 * Update traveler permissions
 */
export async function updateTravelerPermissions(
  tripId: string,
  userId: string,
  permissions: TravelerPermission
): Promise<{ success: boolean; permissions: TravelerPermission }> {
  const { error } = await supabase
    .from('trip_collaborators')
    .update({ permission: permissions })
    .eq('trip_id', tripId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  return { success: true, permissions };
}

// ============================================================================
// Activity Management - Using Supabase saved_items table
// ============================================================================

/**
 * Save an activity
 */
export async function saveActivity(input: {
  activityId: string;
  destinationId: string;
  notes?: string;
  rating?: number;
}): Promise<{ success: boolean; message: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('saved_items')
    .upsert({
      user_id: user.id,
      item_id: input.activityId,
      item_type: 'activity',
      item_data: {
        destinationId: input.destinationId,
        notes: input.notes,
        rating: input.rating,
      },
      notes: input.notes,
    }, { onConflict: 'user_id,item_id,item_type' });

  if (error) throw new Error(error.message);

  return { success: true, message: 'Activity saved' };
}

/**
 * Get saved activities
 */
export async function getSavedActivities(): Promise<{
  activities: SavedActivity[];
  count: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('saved_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('item_type', 'activity')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const activities: SavedActivity[] = (data || []).map(item => {
    const itemData = item.item_data as Record<string, unknown> | null;
    return {
      id: item.id,
      activityId: item.item_id,
      destinationId: (itemData?.destinationId as string) || '',
      notes: item.notes || undefined,
      rating: (itemData?.rating as number) || undefined,
      savedAt: item.created_at,
    };
  });

  return { activities, count: activities.length };
}

/**
 * Get group favorite activities for a trip
 */
export async function getGroupFavorites(tripId: string): Promise<{
  favorites: GroupFavorite[];
  count: number;
}> {
  // Get all collaborators for this trip
  const { data: collaborators } = await supabase
    .from('trip_collaborators')
    .select('user_id')
    .eq('trip_id', tripId);

  const userIds = (collaborators || []).map(c => c.user_id);

  // Get trip owner
  const { data: trip } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single();

  if (trip) userIds.push(trip.user_id);

  if (userIds.length === 0) {
    return { favorites: [], count: 0 };
  }

  // Get saved activities for all users
  const { data: savedItems } = await supabase
    .from('saved_items')
    .select('*')
    .in('user_id', userIds)
    .eq('item_type', 'activity');

  // Aggregate by activity
  const activityVotes: Record<string, { voters: string[]; ratings: number[] }> = {};

  for (const item of savedItems || []) {
    if (!activityVotes[item.item_id]) {
      activityVotes[item.item_id] = { voters: [], ratings: [] };
    }
    activityVotes[item.item_id].voters.push(item.user_id);
    const itemData = item.item_data as Record<string, unknown> | null;
    if (itemData?.rating) {
      activityVotes[item.item_id].ratings.push(itemData.rating as number);
    }
  }

  const favorites: GroupFavorite[] = Object.entries(activityVotes)
    .map(([activityId, data]) => ({
      activityId,
      activityName: `Activity ${activityId.substring(0, 8)}`,
      voteCount: data.voters.length,
      voters: data.voters,
      averageRating: data.ratings.length > 0
        ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
        : 0,
    }))
    .sort((a, b) => b.voteCount - a.voteCount);

  return { favorites, count: favorites.length };
}

// ============================================================================
// Trip Sharing
// ============================================================================

/**
 * Accept a trip invitation
 */
export async function acceptTripInvitation(tripId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('trip_collaborators')
    .update({ accepted_at: new Date().toISOString() })
    .eq('trip_id', tripId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  return { success: true, message: 'Invitation accepted' };
}

/**
 * Get shared trips (trips where user is a collaborator)
 */
export async function getSharedTrips(): Promise<{
  trips: SharedTrip[];
  count: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: collaborations, error } = await supabase
    .from('trip_collaborators')
    .select(`
      permission,
      trips:trip_id (
        id,
        destination,
        start_date,
        end_date,
        status,
        user_id,
        profiles:user_id (display_name)
      )
    `)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  const trips: SharedTrip[] = (collaborations || [])
    .filter(c => c.trips)
    .map(c => {
      const trip = c.trips as unknown as {
        id: string;
        destination: string;
        start_date: string;
        end_date: string;
        status: string;
        profiles: { display_name: string } | null;
      };
      return {
        id: trip.id,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        ownerName: trip.profiles?.display_name || 'Unknown',
        yourPermission: c.permission as TravelerPermission,
        status: trip.status,
      };
    });

  return { trips, count: trips.length };
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useTravelers(tripId: string | undefined) {
  return useQuery({
    queryKey: ['travelers', tripId],
    queryFn: () => getTravelers(tripId!),
    enabled: !!tripId,
    staleTime: 60_000,
  });
}

export function useAddTravelers() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, travelerIds, permissions }: {
      tripId: string;
      travelerIds: string[];
      permissions?: TravelerPermission;
    }) => addTravelers(tripId, travelerIds, permissions),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['travelers', tripId] });
    },
  });
}

export function useRemoveTraveler() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, userId }: { tripId: string; userId: string }) =>
      removeTraveler(tripId, userId),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['travelers', tripId] });
    },
  });
}

export function useUpdateTravelerPermissions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, userId, permissions }: {
      tripId: string;
      userId: string;
      permissions: TravelerPermission;
    }) => updateTravelerPermissions(tripId, userId, permissions),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['travelers', tripId] });
    },
  });
}

export function useSavedActivities() {
  return useQuery({
    queryKey: ['saved-activities'],
    queryFn: getSavedActivities,
    staleTime: 60_000,
  });
}

export function useSaveActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: saveActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-activities'] });
    },
  });
}

export function useGroupFavorites(tripId: string | undefined) {
  return useQuery({
    queryKey: ['group-favorites', tripId],
    queryFn: () => getGroupFavorites(tripId!),
    enabled: !!tripId,
    staleTime: 60_000,
  });
}

export function useSharedTrips() {
  return useQuery({
    queryKey: ['shared-trips'],
    queryFn: getSharedTrips,
    staleTime: 60_000,
  });
}

export function useAcceptTripInvitation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (tripId: string) => acceptTripInvitation(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-trips'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const tripSharingAPI = {
  addTravelers,
  getTravelers,
  removeTraveler,
  updateTravelerPermissions,
  saveActivity,
  getSavedActivities,
  getGroupFavorites,
  acceptTripInvitation,
  getSharedTrips,
};

export default tripSharingAPI;
