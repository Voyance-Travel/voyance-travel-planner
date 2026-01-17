/**
 * Friends API Service
 * Endpoints for friend requests, accepting, declining, and listing friends
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// TYPES
// ============================================================================

export type FriendStatus = 'pending' | 'accepted' | 'declined';

export interface Friend {
  id: string;
  userId: string;
  username: string;
  name?: string;
  avatar?: string;
  status: FriendStatus;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromName?: string;
  fromAvatar?: string;
  status: FriendStatus;
  createdAt: string;
}

export interface VerifyHandleResponse {
  exists: boolean;
}

export interface FriendRequestResponse {
  status: FriendStatus;
}

export interface FriendsListResponse {
  friends: Friend[];
  total: number;
}

export interface PendingRequestsResponse {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
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
 * Verify if a username/handle exists (no data leakage)
 */
export async function verifyHandle(handle: string): Promise<VerifyHandleResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/friends/verify-handle`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ handle }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to verify handle');
  }
  
  return response.json();
}

/**
 * Send or resend a friend request
 */
export async function sendFriendRequest(handle: string): Promise<FriendRequestResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/friends/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ handle }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to send friend request');
  }
  
  return response.json();
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(handle: string): Promise<FriendRequestResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/friends/accept`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ handle }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to accept friend request');
  }
  
  return response.json();
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(
  handle: string,
  reason?: string
): Promise<FriendRequestResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/friends/decline`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ handle, reason }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to decline friend request');
  }
  
  return response.json();
}

/**
 * Remove a friend
 */
export async function removeFriend(handle: string): Promise<{ success: boolean }> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/friends/remove`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ handle }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to remove friend');
  }
  
  return response.json();
}

/**
 * Get list of friends
 */
export async function getFriends(): Promise<FriendsListResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/friends/list`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to get friends list');
  }
  
  return response.json();
}

/**
 * Get pending friend requests (incoming and outgoing)
 */
export async function getPendingRequests(): Promise<PendingRequestsResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/friends/pending`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to get pending requests');
  }
  
  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook to verify a handle exists
 */
export function useVerifyHandle() {
  return useMutation({
    mutationFn: verifyHandle,
  });
}

/**
 * Hook to send a friend request
 */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: (data) => {
      if (data.status === 'accepted') {
        toast.success('Friend request accepted!');
      } else {
        toast.success('Friend request sent');
      }
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send friend request');
    },
  });
}

/**
 * Hook to accept a friend request
 */
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      toast.success('Friend request accepted!');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to accept friend request');
    },
  });
}

/**
 * Hook to decline a friend request
 */
export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ handle, reason }: { handle: string; reason?: string }) =>
      declineFriendRequest(handle, reason),
    onSuccess: () => {
      toast.success('Friend request declined');
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to decline friend request');
    },
  });
}

/**
 * Hook to remove a friend
 */
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

/**
 * Hook to get friends list
 */
export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: getFriends,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get pending requests
 */
export function usePendingRequests() {
  return useQuery({
    queryKey: ['pending-requests'],
    queryFn: getPendingRequests,
    staleTime: 1000 * 60, // 1 minute
  });
}

export default {
  verifyHandle,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriends,
  getPendingRequests,
};
