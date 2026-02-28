/**
 * Friends Service - Supabase
 * 
 * Manages friendships using Lovable Cloud (Supabase)
 * Replaces the Railway backend friends API
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Profile } from './profiles';

// ============================================================================
// TYPES
// ============================================================================

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface FriendProfile {
  id: string;
  handle: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface FriendWithProfile extends Friendship {
  friend: FriendProfile;
}

export interface PendingRequest {
  id: string;
  status: FriendshipStatus;
  created_at: string;
  requester: FriendProfile;
}

/**
 * Get the best display name for a user profile
 * Priority: display_name > first_name + last_name > handle > email > "Unknown"
 */
export function getDisplayName(profile: Partial<FriendProfile> | null | undefined, email?: string | null): string {
  if (!profile) return email || 'Unknown';
  
  if (profile.display_name) return profile.display_name;
  
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  
  if (profile.handle) return `@${profile.handle}`;
  
  if (email) return email.split('@')[0]; // Show username part of email
  
  return 'Unknown';
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get current user ID helper
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

/**
 * Send a friend request by handle
 */
export async function sendFriendRequest(handle: string): Promise<{ success: boolean; status: FriendshipStatus }> {
  const currentUserId = await getCurrentUserId();

  // Find the user by handle
  const { data: targetProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();

  if (profileError) throw profileError;
  if (!targetProfile) throw new Error('User not found');
  if (targetProfile.id === currentUserId) throw new Error('Cannot friend yourself');

  // Check if friendship already exists
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status, requester_id')
    .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${currentUserId})`)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'accepted') {
      throw new Error('Already friends');
    }
    if (existing.status === 'pending' && existing.requester_id === currentUserId) {
      throw new Error('Friend request already sent');
    }
    // If they sent us a request, accept it
    if (existing.status === 'pending' && existing.requester_id === targetProfile.id) {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', existing.id);
      if (error) throw error;
      return { success: true, status: 'accepted' };
    }
    // If previously declined, delete the old row and create a fresh request
    if (existing.status === 'declined') {
      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .eq('id', existing.id);
      if (deleteError) throw deleteError;
      
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({
          requester_id: currentUserId,
          addressee_id: targetProfile.id,
          status: 'pending',
        });
      if (insertError) throw insertError;
      return { success: true, status: 'pending' };
    }
  }

  // Create new friend request
  const { error } = await supabase
    .from('friendships')
    .insert({
      requester_id: currentUserId,
      addressee_id: targetProfile.id,
      status: 'pending',
    });

  if (error) throw error;
  return { success: true, status: 'pending' };
}

/**
 * Send a friend request by email (exact match only)
 */
export async function sendFriendRequestByEmail(email: string): Promise<{ success: boolean; status: FriendshipStatus }> {
  const currentUserId = await getCurrentUserId();

  // Find the user by email using the secure RPC function
  // Cast to unknown first since the types aren't regenerated yet
  const { data: targetUserId, error: profileError } = await supabase
    .rpc('get_user_id_by_email' as any, { lookup_email: email.toLowerCase().trim() }) as { data: string | null; error: any };

  if (profileError) throw new Error('Failed to lookup user');
  if (!targetUserId) throw new Error('No user found with this email');
  if (targetUserId === currentUserId) throw new Error('Cannot friend yourself');

  // Check if friendship already exists
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status, requester_id')
    .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'accepted') {
      throw new Error('Already friends');
    }
    if (existing.status === 'pending' && existing.requester_id === currentUserId) {
      throw new Error('Friend request already sent');
    }
    // If they sent us a request, accept it
    if (existing.status === 'pending' && existing.requester_id === targetUserId) {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', existing.id);
      if (error) throw error;
      return { success: true, status: 'accepted' };
    }
    // If previously declined, delete the old row and create a fresh request
    if (existing.status === 'declined') {
      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .eq('id', existing.id);
      if (deleteError) throw deleteError;
      
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({
          requester_id: currentUserId,
          addressee_id: targetUserId,
          status: 'pending',
        });
      if (insertError) throw insertError;
      return { success: true, status: 'pending' };
    }
  }

  // Create new friend request
  const { error } = await supabase
    .from('friendships')
    .insert({
      requester_id: currentUserId,
      addressee_id: targetUserId,
      status: 'pending' as const,
    });

  if (error) throw error;
  return { success: true, status: 'pending' };
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);

  if (error) throw error;
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'declined' })
    .eq('id', friendshipId);

  if (error) throw error;
}

/**
 * Remove a friend (unfriend)
 */
export async function removeFriend(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);

  if (error) throw error;
}

/**
 * Get list of accepted friends
 */
export async function getFriends(): Promise<FriendWithProfile[]> {
  const currentUserId = await getCurrentUserId();

  // Get friendships where user is requester
  const { data: asRequester, error: error1 } = await supabase
    .from('friendships')
    .select(`
      id,
      requester_id,
      addressee_id,
      status,
      created_at,
      updated_at,
      friend:profiles!friendships_addressee_id_fkey(id, handle, display_name, first_name, last_name, avatar_url)
    `)
    .eq('requester_id', currentUserId)
    .eq('status', 'accepted');

  if (error1) throw error1;

  // Get friendships where user is addressee
  const { data: asAddressee, error: error2 } = await supabase
    .from('friendships')
    .select(`
      id,
      requester_id,
      addressee_id,
      status,
      created_at,
      updated_at,
      friend:profiles!friendships_requester_id_fkey(id, handle, display_name, first_name, last_name, avatar_url)
    `)
    .eq('addressee_id', currentUserId)
    .eq('status', 'accepted');

  if (error2) throw error2;

  // Combine and normalize
  const friends: FriendWithProfile[] = [
    ...(asRequester || []).map(f => ({
      ...f,
      friend: f.friend as unknown as FriendProfile,
    })),
    ...(asAddressee || []).map(f => ({
      ...f,
      friend: f.friend as unknown as FriendProfile,
    })),
  ];

  return friends;
}

/**
 * Get pending friend requests (incoming)
 */
export async function getPendingRequests(): Promise<PendingRequest[]> {
  const currentUserId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      status,
      created_at,
      requester:profiles!friendships_requester_id_fkey(id, handle, display_name, first_name, last_name, avatar_url)
    `)
    .eq('addressee_id', currentUserId)
    .eq('status', 'pending');

  if (error) throw error;

  return (data || []).map(r => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    requester: r.requester as unknown as FriendProfile,
  }));
}

/**
 * Get outgoing friend requests
 */
export async function getOutgoingRequests(): Promise<{ id: string; addressee: FriendProfile; created_at: string }[]> {
  const currentUserId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      created_at,
      addressee:profiles!friendships_addressee_id_fkey(id, handle, display_name, avatar_url)
    `)
    .eq('requester_id', currentUserId)
    .eq('status', 'pending');

  if (error) throw error;

  return (data || []).map(r => ({
    id: r.id,
    created_at: r.created_at,
    addressee: r.addressee as unknown as FriendProfile,
  }));
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: getFriends,
    staleTime: 60_000,
  });
}

export function usePendingRequests() {
  return useQuery({
    queryKey: ['friend-requests', 'pending'],
    queryFn: getPendingRequests,
    staleTime: 30_000,
  });
}

export function useOutgoingRequests() {
  return useQuery({
    queryKey: ['friend-requests', 'outgoing'],
    queryFn: getOutgoingRequests,
    staleTime: 30_000,
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: (result) => {
      if (result.status === 'accepted') {
        toast.success('Friend added!');
      } else {
        toast.success('Friend request sent');
      }
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send friend request');
    },
  });
}

export function useSendFriendRequestByEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendFriendRequestByEmail,
    onSuccess: (result) => {
      if (result.status === 'accepted') {
        toast.success('Friend added!');
      } else {
        toast.success('Friend request sent!');
      }
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error: Error) => {
      // Don't show toast here - let the component handle it for better UX
      throw error;
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      toast.success('Friend request accepted!');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to accept request');
    },
  });
}

export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => {
      toast.success('Friend request declined');
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to decline request');
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      toast.success('Friend removed');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove friend');
    },
  });
}

export function useCancelFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeFriend, // Same underlying function - deletes the friendship record
    onSuccess: () => {
      toast.success('Friend request cancelled');
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel request');
    },
  });
}
