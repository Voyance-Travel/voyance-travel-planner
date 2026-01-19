/**
 * Voyance Activity Alternatives API Service
 * 
 * Integrates with Railway backend activity alternatives endpoints:
 * - POST /api/v1/activities/alternatives - Get alternative activities
 * - POST /api/v1/activities/swap - Swap an activity in the itinerary
 * - POST /api/v1/activities/lock - Lock an activity
 * - POST /api/v1/activities/unlock - Unlock an activity
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export type TimeSlot = 'morning' | 'afternoon' | 'evening';
export type WeatherDependency = 'low' | 'medium' | 'high';

export interface ActivityLocation {
  coordinates: {
    lat: number;
    lng: number;
  };
  address: string;
}

export interface PreferenceProfile {
  activityTypes: Record<string, number>;
  pacePreference: number;
  luxuryLevel: number;
  adventureLevel: number;
}

export interface AlternativeActivity {
  id: string;
  title: string;
  description: string;
  location: ActivityLocation;
  cost: number;
  duration: number;
  category: string;
  tags: string[];
  seasonality: string[];
  weatherDependency: WeatherDependency;
  travelDnaScore?: number;
  verified: boolean;
  imageUrl?: string;
}

export interface GetAlternativesInput {
  destinationId: string;
  currentActivityId: string;
  timeSlot: TimeSlot;
  preferenceProfile?: PreferenceProfile;
  maxResults?: number;
}

export interface AlternativesResponse {
  success: boolean;
  alternatives?: AlternativeActivity[];
  currentActivity?: AlternativeActivity;
  count?: number;
  cached?: boolean;
  error?: string;
}

export interface SwapActivityInput {
  tripId: string;
  dayIndex: number;
  timeSlot: TimeSlot;
  newActivityId: string;
}

export interface SwapActivityResponse {
  success: boolean;
  message?: string;
  updatedDay?: {
    date: string;
    activities: Record<TimeSlot, AlternativeActivity>;
  };
  error?: string;
}

export interface LockActivityInput {
  tripId: string;
  dayIndex: number;
  timeSlot: TimeSlot;
  activityId: string;
}

export interface LockActivityResponse {
  success: boolean;
  message?: string;
  lockedActivities?: string[];
  error?: string;
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

async function activityApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/activities${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Activity Alternatives API
// ============================================================================

/**
 * Get alternative activities for a time slot
 */
export async function getActivityAlternatives(
  input: GetAlternativesInput
): Promise<AlternativesResponse> {
  try {
    const response = await activityApiRequest<AlternativesResponse>('/alternatives', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[ActivityAPI] Get alternatives error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get alternatives',
    };
  }
}

/**
 * Swap an activity in the itinerary
 */
export async function swapActivity(
  input: SwapActivityInput
): Promise<SwapActivityResponse> {
  try {
    const response = await activityApiRequest<SwapActivityResponse>('/swap', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[ActivityAPI] Swap activity error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to swap activity',
    };
  }
}

/**
 * Lock an activity to prevent regeneration
 */
export async function lockActivity(
  input: LockActivityInput
): Promise<LockActivityResponse> {
  try {
    const response = await activityApiRequest<LockActivityResponse>('/lock', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[ActivityAPI] Lock activity error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to lock activity',
    };
  }
}

/**
 * Unlock an activity to allow regeneration
 */
export async function unlockActivity(
  input: LockActivityInput
): Promise<LockActivityResponse> {
  try {
    const response = await activityApiRequest<LockActivityResponse>('/unlock', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[ActivityAPI] Unlock activity error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unlock activity',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useActivityAlternatives(input: GetAlternativesInput | null) {
  return useQuery({
    queryKey: ['activity-alternatives', input?.destinationId, input?.currentActivityId, input?.timeSlot],
    queryFn: () => input ? getActivityAlternatives(input) : Promise.reject('No input'),
    enabled: !!input?.destinationId && !!input?.currentActivityId && !!input?.timeSlot,
    staleTime: 5 * 60_000, // 5 minutes cache
  });
}

export function useSwapActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: swapActivity,
    onSuccess: (_, variables) => {
      // Invalidate trip and itinerary queries
      queryClient.invalidateQueries({ queryKey: ['trip', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['itinerary', variables.tripId] });
    },
  });
}

export function useLockActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: lockActivity,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['locked-activities', variables.tripId] });
    },
  });
}

export function useUnlockActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: unlockActivity,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['locked-activities', variables.tripId] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const activityAlternativesAPI = {
  getActivityAlternatives,
  swapActivity,
  lockActivity,
  unlockActivity,
};

export default activityAlternativesAPI;
