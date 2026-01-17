/**
 * Trip Save/Resume API Service
 * 
 * Handles intelligent trip state management with modular storage,
 * drift detection, and progressive resume flows.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export type SaveStatus = 'active' | 'archived' | 'completed' | 'abandoned';
export type ResumeReadiness = 'immediate' | 'guided' | 'refresh' | 'restart';

export interface SaveTripInput {
  stepCompleted?: string;
  components?: {
    flights?: unknown;
    hotels?: unknown;
    activities?: unknown;
    preferences?: unknown;
  };
  metadata?: Record<string, unknown>;
  timeSpent?: number;
}

export interface ResumeTripInput {
  resumeOption?: 'continue' | 'refresh' | 'restart';
  confirmDrift?: boolean;
}

export interface SaveTripResponse {
  success: boolean;
  completionPercentage: number;
  saveCount: number;
  lastSavedAt: string;
  expiresAt?: string;
  message?: string;
}

export interface ResumeTripResponse {
  success: boolean;
  resumeFlow: {
    type: ResumeReadiness;
    steps?: string[];
    recommendedAction?: string;
  };
  dataAge: number;
  driftAnalysis?: {
    hasSignificantDrift: boolean;
    driftDetails?: {
      type: string;
      message: string;
    }[];
  };
  sessionStatus: {
    action: string;
    sessionId?: string;
  };
  tripData?: Record<string, unknown>;
}

export interface SaveStatusResponse {
  hasSave: boolean;
  saveStatus?: SaveStatus;
  completionPercentage?: number;
  lastStepCompleted?: string;
  lastSavedAt?: string;
  saveCount?: number;
  totalTimeSpent?: number;
  daysSinceLastSave?: number;
  resumeReadiness?: ResumeReadiness;
  expiresAt?: string;
  isExpired?: boolean;
  hasActiveSession?: boolean;
  canResume?: boolean;
  message?: string;
}

export interface SessionStatusResponse {
  sessionStatus: 'available' | 'conflict';
  canEdit: boolean;
  message: string;
  sessionId: string;
  conflictDetails?: {
    conflictingSessionId: string;
    lastActiveMinutes: number;
    canTakeOver: boolean;
    autoResolveIn: number;
  } | null;
}

export interface SavedTripSummary {
  id: string;
  tripId: string;
  saveStatus: SaveStatus;
  completionPercentage: number;
  lastStepCompleted?: string;
  lastSavedAt: string;
  saveCount: number;
  totalTimeSpent?: number;
  expiresAt?: string;
  daysSinceLastSave: number;
  resumeReadiness: ResumeReadiness;
  isExpired: boolean;
  canResume: boolean;
}

export interface ListSavedTripsResponse {
  savedTrips: SavedTripSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface CleanupResponse {
  deleted: number;
  archived: number;
  skipped: number;
  message: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  const token = localStorage.getItem('voyance_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Save current trip progress
 */
export async function saveTripProgress(
  tripId: string,
  input: SaveTripInput
): Promise<SaveTripResponse> {
  const headers = await getAuthHeader();
  const sessionId = sessionStorage.getItem('trip_session_id') || `session-${Date.now()}`;
  
  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId,
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Save failed' }));
    throw new Error(error.error || 'Failed to save trip progress');
  }

  return response.json();
}

/**
 * Resume a saved trip with progressive flow
 */
export async function resumeTrip(
  tripId: string,
  input: ResumeTripInput = {}
): Promise<ResumeTripResponse> {
  const headers = await getAuthHeader();
  const sessionId = `session-${Date.now()}`;
  sessionStorage.setItem('trip_session_id', sessionId);

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/resume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId,
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Resume failed' }));
    throw new Error(error.error || 'Failed to resume trip');
  }

  return response.json();
}

/**
 * Get save status for a trip
 */
export async function getTripSaveStatus(tripId: string): Promise<SaveStatusResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/save-status`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to get save status');
  }

  return response.json();
}

/**
 * Get session status and check for conflicts
 */
export async function getSessionStatus(tripId: string): Promise<SessionStatusResponse> {
  const headers = await getAuthHeader();
  const sessionId = sessionStorage.getItem('trip_session_id') || `session-${Date.now()}`;

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/session-status`, {
    headers: {
      'X-Session-ID': sessionId,
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to get session status');
  }

  return response.json();
}

/**
 * List all saved trips for the current user
 */
export async function listSavedTrips(params?: {
  status?: SaveStatus;
  limit?: number;
  offset?: number;
}): Promise<ListSavedTripsResponse> {
  const headers = await getAuthHeader();
  const queryParams = new URLSearchParams();
  
  if (params?.status) queryParams.set('status', params.status);
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());

  const url = `${API_BASE_URL}/api/v1/trips/saved${queryParams.toString() ? `?${queryParams}` : ''}`;
  
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to list saved trips');
  }

  return response.json();
}

/**
 * Delete saved trip data
 */
export async function deleteSavedTrip(tripId: string): Promise<{ deleted: boolean; message: string }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trips/${tripId}/save`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(error.error || 'Failed to delete saved trip');
  }

  return response.json();
}

/**
 * Run cleanup of old saved trips
 */
export async function cleanupSavedTrips(params?: {
  dryRun?: boolean;
  olderThanDays?: number;
}): Promise<CleanupResponse> {
  const headers = await getAuthHeader();
  const queryParams = new URLSearchParams();
  
  if (params?.dryRun !== undefined) queryParams.set('dryRun', params.dryRun.toString());
  if (params?.olderThanDays) queryParams.set('olderThanDays', params.olderThanDays.toString());

  const url = `${API_BASE_URL}/api/v1/trips/cleanup${queryParams.toString() ? `?${queryParams}` : ''}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Cleanup failed' }));
    throw new Error(error.error || 'Failed to cleanup saved trips');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useSaveTripProgress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input: SaveTripInput }) =>
      saveTripProgress(tripId, input),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip-save-status', tripId] });
      queryClient.invalidateQueries({ queryKey: ['saved-trips'] });
    },
  });
}

export function useResumeTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input?: ResumeTripInput }) =>
      resumeTrip(tripId, input),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip-save-status', tripId] });
    },
  });
}

export function useTripSaveStatus(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['trip-save-status', tripId],
    queryFn: () => getTripSaveStatus(tripId),
    enabled: !!tripId && enabled,
    staleTime: 30000,
  });
}

export function useSessionStatus(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['session-status', tripId],
    queryFn: () => getSessionStatus(tripId),
    enabled: !!tripId && enabled,
    staleTime: 10000,
    refetchInterval: 30000, // Check for conflicts periodically
  });
}

export function useSavedTrips(params?: {
  status?: SaveStatus;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['saved-trips', params],
    queryFn: () => listSavedTrips(params),
    staleTime: 60000,
  });
}

export function useDeleteSavedTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteSavedTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-trips'] });
    },
  });
}

export function useCleanupSavedTrips() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: cleanupSavedTrips,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-trips'] });
    },
  });
}
