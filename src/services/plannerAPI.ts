/**
 * Voyance Planner API
 * 
 * Trip planner endpoints for creating and managing trips:
 * - POST /api/v1/planner/trips - Create draft trip
 * - PATCH /api/v1/planner/trips/:id - Update trip
 * - GET /api/v1/planner/trips/:id - Get trip details
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface TripDestination {
  city: string;
  country?: string;
  nights?: number;
}

export interface TripCreateInput {
  originCity: string;
  destinations: TripDestination[];
  startDate: string;
  endDate: string;
  tripType: 'vacation' | 'business' | 'adventure' | 'romantic' | 'family';
  travelers: number;
  budgetTier?: 'safe' | 'stretch' | 'splurge';
}

export interface TripUpdateInput {
  originCity?: string;
  destinations?: TripDestination[];
  startDate?: string;
  endDate?: string;
  tripType?: 'vacation' | 'business' | 'adventure' | 'romantic' | 'family';
  travelers?: number;
}

export interface PlannerTrip {
  id: string;
  sessionId: string;
  name: string;
  originCity: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  travelers: number;
  status: 'draft' | 'planning' | 'booked' | 'completed';
  metadata?: Record<string, unknown>;
}

export interface CreateTripResponse {
  tripId: string;
  sessionId: string;
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
    throw new Error(errorData.error || errorData._error || errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Planner API
// ============================================================================

/**
 * Create a new draft trip
 */
export async function createPlannerTrip(input: TripCreateInput): Promise<CreateTripResponse> {
  return apiRequest<CreateTripResponse>('/api/v1/planner/trips', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update an existing trip
 */
export async function updatePlannerTrip(
  tripId: string,
  updates: TripUpdateInput
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/api/v1/planner/trips/${tripId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Get trip details by ID
 */
export async function getPlannerTrip(tripId: string): Promise<PlannerTrip> {
  return apiRequest<PlannerTrip>(`/api/v1/planner/trips/${tripId}`, {
    method: 'GET',
  });
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function usePlannerTrip(tripId: string | undefined) {
  return useQuery({
    queryKey: ['planner-trip', tripId],
    queryFn: () => getPlannerTrip(tripId!),
    enabled: !!tripId,
    staleTime: 30_000,
  });
}

export function useCreatePlannerTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPlannerTrip,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['planner-trip', data.tripId] });
    },
  });
}

export function useUpdatePlannerTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, updates }: { tripId: string; updates: TripUpdateInput }) =>
      updatePlannerTrip(tripId, updates),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['planner-trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const plannerAPI = {
  createTrip: createPlannerTrip,
  updateTrip: updatePlannerTrip,
  getTrip: getPlannerTrip,
};

export default plannerAPI;
