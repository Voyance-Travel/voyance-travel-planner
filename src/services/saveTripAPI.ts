/**
 * Save Trip API Service
 * 
 * Handles trip creation, update, and resume operations.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateTripInput {
  tripName: string;
}

export interface CreateTripResponse {
  sessionId: string;
  status: string;
}

export interface UpdateTripInput {
  tripName?: string;
  timeline?: Record<string, unknown>;
  emotionalTags?: string[];
}

export interface SavedTripData {
  id: string;
  name: string;
  sessionId: string;
  userId: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  timeline?: Record<string, unknown>;
  emotionalTags?: string[];
  createdAt: string;
  updatedAt: string;
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
 * Create a new trip
 */
export async function createSaveTrip(input: CreateTripInput): Promise<CreateTripResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Create failed' }));
    throw new Error(error.error || 'Failed to create trip');
  }

  return response.json();
}

/**
 * Update an existing trip
 */
export async function updateSaveTrip(
  sessionId: string,
  updates: UpdateTripInput
): Promise<{ status: string }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/save/update/${sessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Update failed' }));
    throw new Error(error.error || 'Failed to update trip');
  }

  return response.json();
}

/**
 * Resume/get a saved trip by session ID
 */
export async function resumeSaveTrip(sessionId: string): Promise<SavedTripData> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/save/resume/${sessionId}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Resume failed' }));
    throw new Error(error.error || 'Failed to resume trip');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useCreateSaveTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSaveTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useUpdateSaveTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, updates }: { sessionId: string; updates: UpdateTripInput }) =>
      updateSaveTrip(sessionId, updates),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['save-trip', sessionId] });
    },
  });
}

export function useResumeSaveTrip(sessionId: string | null) {
  return useQuery({
    queryKey: ['save-trip', sessionId],
    queryFn: () => resumeSaveTrip(sessionId!),
    enabled: !!sessionId,
    staleTime: 30000,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTripStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'In Progress',
    SAVED: 'Saved',
    booked: 'Booked',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

export function getTripStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'text-yellow-600',
    SAVED: 'text-blue-600',
    booked: 'text-green-600',
    completed: 'text-gray-600',
    cancelled: 'text-red-600',
  };
  return colors[status] || 'text-gray-600';
}
