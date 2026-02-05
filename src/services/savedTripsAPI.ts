/**
 * Saved Trips API Service
 * 
 * Handles saving/bookmarking trips for later reference.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export interface SavedTripInfo {
  id: string;
  savedAt: string;
  notes?: string;
  tags?: string[];
  trip: {
    id: string;
    name: string;
    destination: string;
    departureCity?: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    status: string;
    budget?: number;
    currency?: string;
    travelers?: number;
    emotionalTags?: string[];
    createdAt: string;
  };
}

export interface SavedTripsResponse {
  savedTrips: SavedTripInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SaveTripResponse {
  message: string;
  savedTrip: {
    id: string;
    tripId: string;
    savedAt: string;
    trip: {
      id: string;
      name: string;
      destination: string;
      startDate: string;
      endDate: string;
      status: string;
    };
  };
}

export interface TripSavedStatus {
  isSaved: boolean;
  savedAt: string | null;
  savedTripId: string | null;
}

export interface BulkSavedStatus {
  statuses: Array<{
    tripId: string;
    isSaved: boolean;
    savedAt: string | null;
  }>;
}

export interface UpdateSavedTripInput {
  notes?: string;
  tags?: string[];
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  // No legacy token fallback - require valid Supabase session
  return {};
}

/**
 * Save a trip for later
 */
export async function saveTrip(tripId: string): Promise<SaveTripResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Save failed' }));
    throw new Error(error.error || 'Failed to save trip');
  }

  return response.json();
}

/**
 * Unsave/remove a trip from saved list
 */
export async function unsaveTrip(tripId: string): Promise<{ message: string; tripId: string }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/save`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unsave failed' }));
    throw new Error(error.error || 'Failed to unsave trip');
  }

  return response.json();
}

/**
 * Get all saved trips for the current user
 */
export async function getSavedTrips(params?: {
  page?: number;
  limit?: number;
}): Promise<SavedTripsResponse> {
  const headers = await getAuthHeader();
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());

  const url = `${API_BASE_URL}/api/v1/trips/saved${queryParams.toString() ? `?${queryParams}` : ''}`;
  
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch saved trips');
  }

  return response.json();
}

/**
 * Check if a trip is saved
 */
export async function isTripSaved(tripId: string): Promise<TripSavedStatus> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/is-saved`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Check failed' }));
    throw new Error(error.error || 'Failed to check saved status');
  }

  return response.json();
}

/**
 * Bulk check saved status for multiple trips
 */
export async function bulkCheckSavedStatus(tripIds: string[]): Promise<BulkSavedStatus> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/saved-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ tripIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Bulk check failed' }));
    throw new Error(error.error || 'Failed to check saved statuses');
  }

  return response.json();
}

/**
 * Update a saved trip (notes, tags)
 */
export async function updateSavedTrip(
  savedTripId: string,
  input: UpdateSavedTripInput
): Promise<{ message: string; savedTrip: SavedTripInfo }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/saved-trips/${savedTripId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Update failed' }));
    throw new Error(error.error || 'Failed to update saved trip');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useSaveTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: saveTrip,
    onSuccess: (_, tripId) => {
      queryClient.invalidateQueries({ queryKey: ['saved-trips'] });
      queryClient.invalidateQueries({ queryKey: ['trip-saved-status', tripId] });
    },
  });
}

export function useUnsaveTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: unsaveTrip,
    onSuccess: (_, tripId) => {
      queryClient.invalidateQueries({ queryKey: ['saved-trips'] });
      queryClient.invalidateQueries({ queryKey: ['trip-saved-status', tripId] });
    },
  });
}

export function useUserSavedTrips(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['saved-trips', params],
    queryFn: () => getSavedTrips(params),
    staleTime: 60000,
  });
}

export function useTripSavedStatus(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['trip-saved-status', tripId],
    queryFn: () => isTripSaved(tripId),
    enabled: !!tripId && enabled,
    staleTime: 30000,
  });
}

export function useBulkSavedStatus(tripIds: string[]) {
  return useQuery({
    queryKey: ['bulk-saved-status', tripIds],
    queryFn: () => bulkCheckSavedStatus(tripIds),
    enabled: tripIds.length > 0,
    staleTime: 30000,
  });
}

export function useUpdateSavedTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ savedTripId, input }: { savedTripId: string; input: UpdateSavedTripInput }) =>
      updateSavedTrip(savedTripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-trips'] });
    },
  });
}

/**
 * Toggle save status for a trip
 */
export function useToggleTripSave() {
  const saveTripMutation = useSaveTrip();
  const unsaveTripMutation = useUnsaveTrip();

  return {
    toggle: async (tripId: string, currentlySaved: boolean) => {
      if (currentlySaved) {
        return unsaveTripMutation.mutateAsync(tripId);
      } else {
        return saveTripMutation.mutateAsync(tripId);
      }
    },
    isPending: saveTripMutation.isPending || unsaveTripMutation.isPending,
  };
}
