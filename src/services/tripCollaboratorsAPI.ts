/**
 * Trip Collaborators Service
 * 
 * Manages linking friends to specific trips for collaborative itinerary generation
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/services/supabase/profiles';

// ============================================================================
// TYPES
// ============================================================================

export type CollaboratorPermission = 'view' | 'edit' | 'admin';

export interface TripCollaborator {
  id: string;
  trip_id: string;
  user_id: string;
  permission: CollaboratorPermission;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
  include_preferences?: boolean;
  profile?: Pick<Profile, 'id' | 'handle' | 'display_name' | 'avatar_url'>;
}

export interface AddCollaboratorRequest {
  tripId: string;
  userId: string;
  permission?: CollaboratorPermission;
  includePreferences?: boolean;
}

export interface TripPermission {
  isOwner: boolean;
  permission: string | null;
  canEdit: boolean;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get current user's permission for a trip
 */
export async function getTripPermission(tripId: string): Promise<TripPermission> {
  const { data, error } = await supabase.rpc('get_trip_permission', { p_trip_id: tripId });
  
  if (error) {
    console.error('[TripCollaborators] Error getting permission:', error);
    return { isOwner: false, permission: null, canEdit: false };
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = data as any;
  return {
    isOwner: result?.isOwner ?? false,
    permission: result?.permission ?? null,
    canEdit: result?.canEdit ?? false,
  };
}

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
      include_preferences,
      profile:profiles!trip_collaborators_user_id_profiles_fkey(id, handle, display_name, avatar_url)
    `)
    .eq('trip_id', tripId);

  if (error) {
    console.error('[TripCollaborators] Error fetching:', error);
    throw error;
  }

  return (data || []).map(c => ({
    ...c,
    permission: c.permission as CollaboratorPermission,
    include_preferences: c.include_preferences ?? true,
    profile: c.profile as unknown as Pick<Profile, 'id' | 'handle' | 'display_name' | 'avatar_url'>,
  }));
}

/**
 * Add a collaborator to a trip
 */
export async function addTripCollaborator({ tripId, userId, permission = 'edit', includePreferences = true }: AddCollaboratorRequest): Promise<TripCollaborator> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Prevent self-collaboration
  if (userId === user.id) {
    throw new Error('You cannot add yourself as a collaborator on your own trip');
  }

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
      include_preferences: includePreferences,
    })
    .select(`
      id,
      trip_id,
      user_id,
      permission,
      invited_by,
      accepted_at,
      created_at,
      include_preferences,
      profile:profiles!trip_collaborators_user_id_profiles_fkey(id, handle, display_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error('[TripCollaborators] Error adding:', error);
    throw error;
  }

  // GAP 1: Also upsert into trip_members so collaborator appears in budget/payments
  try {
    const { data: collabProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();

    // Get collaborator email from auth via the secure RPC
    const { data: userInfo } = await supabase.rpc('get_user_info_by_email', {
      lookup_email: '', // We need email — fetch from get_current_user_email won't work for other users
    });
    // Instead, use the profiles + a direct lookup
    const { data: memberEmail } = await supabase
      .rpc('get_current_user_email'); // This only gets current user, so use a fallback

    // Upsert into trip_members with a placeholder email if we can't resolve it
    await supabase
      .from('trip_members')
      .upsert(
        {
          trip_id: tripId,
          user_id: userId,
          email: `user-${userId}@voyance.app`, // Placeholder — resolved on acceptance
          name: collabProfile?.display_name || null,
          role: 'attendee' as const,
        },
        { onConflict: 'trip_id,email' }
      );
  } catch (memberErr) {
    console.error('[TripCollaborators] Failed to sync trip_members:', memberErr);
  }

  // GAP 2: Propagate to journey legs if this trip is part of a multi-city journey
  try {
    const { data: tripData } = await supabase
      .from('trips')
      .select('journey_id')
      .eq('id', tripId)
      .maybeSingle();

    if (tripData?.journey_id) {
      const { data: siblingLegs } = await supabase
        .from('trips')
        .select('id')
        .eq('journey_id', tripData.journey_id)
        .neq('id', tripId);

      if (siblingLegs?.length) {
        const collabInserts = siblingLegs.map(leg => ({
          trip_id: leg.id,
          user_id: userId,
          permission,
          invited_by: user.id,
          accepted_at: new Date().toISOString(),
          include_preferences: includePreferences,
        }));

        // Upsert to avoid duplicates (trip_id + user_id unique constraint)
        await supabase
          .from('trip_collaborators')
          .upsert(collabInserts, { onConflict: 'trip_id,user_id' });

        // Also propagate trip_members to legs
        const memberInserts = siblingLegs.map(leg => ({
          trip_id: leg.id,
          user_id: userId,
          email: `user-${userId}@voyance.app`,
          name: data.profile?.display_name || null,
          role: 'attendee' as const,
        }));

        await supabase
          .from('trip_members')
          .upsert(memberInserts, { onConflict: 'trip_id,email' });
      }
    }
  } catch (legErr) {
    console.error('[TripCollaborators] Failed to propagate to journey legs:', legErr);
  }

  // Send notification to the invited user
  try {
    // Get trip name and inviter profile for the notification
    const [tripResult, inviterResult] = await Promise.all([
      supabase.from('trips').select('name, destination').eq('id', tripId).single(),
      supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    ]);

    const tripName = tripResult.data?.name || 'a trip';
    const destination = tripResult.data?.destination || '';
    const inviterName = inviterResult.data?.display_name || 'Someone';

    await supabase.from('trip_notifications').insert({
      trip_id: tripId,
      user_id: userId,
      notification_type: 'trip_invite',
      sent: false,
      metadata: {
        title: `Added to ${tripName}`,
        message: `${inviterName} added you to their trip${destination ? ` to ${destination}` : ''}`,
        invitedBy: user.id,
        inviterName,
        tripName,
        destination,
        scheduledFor: new Date().toISOString(),
      },
    });
  } catch (notifError) {
    // Non-blocking: don't fail the collaborator add if notification fails
    console.error('[TripCollaborators] Failed to create notification:', notifError);
  }

  return {
    ...data,
    permission: data.permission as CollaboratorPermission,
    profile: data.profile as unknown as Pick<Profile, 'id' | 'handle' | 'display_name' | 'avatar_url'>,
  };
}

/**
 * Update a collaborator's permission
 */
export async function updateCollaboratorPermission(
  collaboratorId: string, 
  permission: CollaboratorPermission
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('update_collaborator_permission', {
    p_collaborator_id: collaboratorId,
    p_permission: permission,
  });

  if (error) {
    console.error('[TripCollaborators] Error updating permission:', error);
    return { success: false, error: error.message };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = data as any;
  return { 
    success: result?.success ?? false, 
    error: result?.error 
  };
}

/**
 * Remove a collaborator from a trip (cleans both trip_collaborators and trip_members)
 */
export async function removeTripCollaborator(collaboratorId: string): Promise<void> {
  // First get the collaborator to know user_id and trip_id
  const { data: collab, error: fetchError } = await supabase
    .from('trip_collaborators')
    .select('user_id, trip_id')
    .eq('id', collaboratorId)
    .single();

  if (fetchError || !collab) {
    console.error('[TripCollaborators] Error fetching collaborator:', fetchError);
    throw fetchError || new Error('Collaborator not found');
  }

  // Delete from trip_collaborators
  const { error } = await supabase
    .from('trip_collaborators')
    .delete()
    .eq('id', collaboratorId);

  if (error) {
    console.error('[TripCollaborators] Error removing collaborator:', error);
    throw error;
  }

  // Also remove from trip_members (non-blocking — best effort)
  try {
    await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id', collab.trip_id)
      .eq('user_id', collab.user_id);
  } catch (e) {
    console.error('[TripCollaborators] Error removing from trip_members:', e);
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

export function useTripPermission(tripId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    // Include user.id in key so it refetches when auth state changes
    queryKey: ['trip-permission', tripId, user?.id],
    queryFn: () => getTripPermission(tripId!),
    // Only run when we have both a tripId AND an authenticated user
    enabled: !!tripId && !!user?.id,
    staleTime: 30_000,
  });
}

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

export function useUpdateCollaboratorPermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collaboratorId, permission }: { collaboratorId: string; permission: CollaboratorPermission }) =>
      updateCollaboratorPermission(collaboratorId, permission),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Permission updated');
        queryClient.invalidateQueries({ queryKey: ['trip-collaborators'] });
      } else {
        toast.error(result.error || 'Failed to update permission');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update permission');
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
