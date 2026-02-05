/**
 * Trip Context API Service
 * 
 * Manages trip session context for the planning flow.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export type BudgetLevel = 'budget' | 'mid-range' | 'luxury';

export interface TripContextDestination {
  slug: string;
  city?: string;
  country?: string;
  id?: string;
}

export interface TripContextDateRange {
  startDate: string;
  endDate: string;
}

export interface TripContextTravelers {
  adults: number;
  children: number;
}

export interface TripContextPreferences {
  tags?: string[];
  activities?: string[];
}

export interface TripContextInput {
  destination?: TripContextDestination;
  dateRange?: TripContextDateRange;
  travelers?: TripContextTravelers;
  budget?: BudgetLevel;
  preferences?: TripContextPreferences;
  currentStep?: string;
}

export interface TripContext extends TripContextInput {
  userId?: string;
  updated_at?: string;
  createdAt?: string;
}

export interface TripContextResponse {
  success: boolean;
  sessionId: string;
  context: TripContext;
  nextStep: string;
  message?: string;
}

export interface SelectDestinationResponse {
  success: boolean;
  sessionId: string;
  destination: {
    id: string;
    city: string;
    country: string;
    region?: string;
    description?: string;
  };
  redirectUrl: string;
  context: TripContext;
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

function getSessionId(): string | undefined {
  return sessionStorage.getItem('trip_session_id') || undefined;
}

function setSessionId(sessionId: string): void {
  sessionStorage.setItem('trip_session_id', sessionId);
}

/**
 * Save or update trip context
 */
export async function saveTripContext(input: TripContextInput): Promise<TripContextResponse> {
  const headers = await getAuthHeader();
  const sessionId = getSessionId();

  const response = await fetch(`${API_BASE_URL}/api/v1/trip-context`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Save failed' }));
    throw new Error(error.error || 'Failed to save trip context');
  }

  const result = await response.json();
  
  // Store the session ID for future requests
  if (result.sessionId) {
    setSessionId(result.sessionId);
  }

  return result;
}

/**
 * Get current trip context
 */
export async function getTripContext(): Promise<TripContextResponse> {
  const headers = await getAuthHeader();
  const sessionId = getSessionId();

  const response = await fetch(`${API_BASE_URL}/api/v1/trip-context`, {
    headers: {
      ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to get trip context');
  }

  return response.json();
}

/**
 * Clear trip context
 */
export async function clearTripContext(): Promise<{ success: boolean; message: string }> {
  const headers = await getAuthHeader();
  const sessionId = getSessionId();

  const response = await fetch(`${API_BASE_URL}/api/v1/trip-context`, {
    method: 'DELETE',
    headers: {
      ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Clear failed' }));
    throw new Error(error.error || 'Failed to clear trip context');
  }

  // Clear local session ID
  sessionStorage.removeItem('trip_session_id');

  return response.json();
}

/**
 * Select a destination from the Explore page
 */
export async function selectDestination(slug: string): Promise<SelectDestinationResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/trip-context/select-destination`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ slug }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Selection failed' }));
    throw new Error(error.error || 'Failed to select destination');
  }

  const result = await response.json();
  
  // Store the session ID for future requests
  if (result.sessionId) {
    setSessionId(result.sessionId);
  }

  return result;
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useTripContext() {
  return useQuery({
    queryKey: ['trip-context'],
    queryFn: getTripContext,
    staleTime: 30000,
    retry: 1,
  });
}

export function useSaveTripContext() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: saveTripContext,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-context'] });
    },
  });
}

export function useClearTripContext() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: clearTripContext,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['trip-context'] });
    },
  });
}

export function useSelectDestination() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: selectDestination,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-context'] });
    },
  });
}

/**
 * Update specific fields in trip context
 */
export function useUpdateTripContextField() {
  const { mutateAsync: saveContext } = useSaveTripContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: Partial<TripContextInput>) => {
      const currentContext = queryClient.getQueryData<TripContextResponse>(['trip-context']);
      const mergedContext = {
        ...currentContext?.context,
        ...update,
      };
      return saveContext(mergedContext);
    },
  });
}
