/**
 * Voyance Trip Sharing API
 * 
 * Trip sharing and collaboration endpoints:
 * - POST /api/v1/trips/:tripId/travelers - Add travelers
 * - GET /api/v1/trips/:tripId/travelers - Get travelers
 * - DELETE /api/v1/trips/:tripId/travelers/:userId - Remove traveler
 * - PATCH /api/v1/trips/:tripId/travelers/:userId/permissions - Update permissions
 * - POST /api/v1/activities/save - Save activity
 * - GET /api/v1/activities/saved - Get saved activities
 * - GET /api/v1/trips/:tripId/group-favorites - Get group favorites
 * - POST /api/v1/trips/:tripId/accept - Accept trip invitation
 * - GET /api/v1/trips/shared - Get shared trips
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

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
// API Helpers
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

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData._error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Traveler Management
// ============================================================================

/**
 * Add travelers to a trip
 */
export async function addTravelers(
  tripId: string,
  travelerIds: string[],
  permissions: TravelerPermission = 'edit'
): Promise<{ success: boolean; added: string[] }> {
  return apiRequest(`/api/v1/trips/${tripId}/travelers`, {
    method: 'POST',
    body: JSON.stringify({ travelerIds, permissions }),
  });
}

/**
 * Get travelers for a trip
 */
export async function getTravelers(tripId: string): Promise<TravelersResponse> {
  return apiRequest<TravelersResponse>(`/api/v1/trips/${tripId}/travelers`, {
    method: 'GET',
  });
}

/**
 * Remove a traveler from a trip
 */
export async function removeTraveler(
  tripId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/api/v1/trips/${tripId}/travelers/${userId}`, {
    method: 'DELETE',
  });
}

/**
 * Update traveler permissions
 */
export async function updateTravelerPermissions(
  tripId: string,
  userId: string,
  permissions: TravelerPermission
): Promise<{ success: boolean; permissions: TravelerPermission }> {
  return apiRequest(`/api/v1/trips/${tripId}/travelers/${userId}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  });
}

// ============================================================================
// Activity Management
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
  return apiRequest('/api/v1/activities/save', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Get saved activities
 */
export async function getSavedActivities(): Promise<{
  activities: SavedActivity[];
  count: number;
}> {
  return apiRequest('/api/v1/activities/saved', {
    method: 'GET',
  });
}

/**
 * Get group favorite activities for a trip
 */
export async function getGroupFavorites(tripId: string): Promise<{
  favorites: GroupFavorite[];
  count: number;
}> {
  return apiRequest(`/api/v1/trips/${tripId}/group-favorites`, {
    method: 'GET',
  });
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
  return apiRequest(`/api/v1/trips/${tripId}/accept`, {
    method: 'POST',
  });
}

/**
 * Get shared trips
 */
export async function getSharedTrips(): Promise<{
  trips: SharedTrip[];
  count: number;
}> {
  return apiRequest('/api/v1/trips/shared', {
    method: 'GET',
  });
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
  // Travelers
  addTravelers,
  getTravelers,
  removeTraveler,
  updateTravelerPermissions,
  
  // Activities
  saveActivity,
  getSavedActivities,
  getGroupFavorites,
  
  // Sharing
  acceptTripInvitation,
  getSharedTrips,
};

export default tripSharingAPI;
