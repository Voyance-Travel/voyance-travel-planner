/**
 * Voyance Trip Activities API Service
 * 
 * Integrates with Railway backend trip activities endpoints:
 * - PATCH /api/v1/activities/:activityId - Update activity
 * - DELETE /api/v1/activities/:activityId - Delete activity
 * - PATCH /api/v1/activities/:activityId/move - Move activity
 * - PATCH /api/v1/activities/:activityId/lock - Lock activity
 * - PATCH /api/v1/activities/:activityId/unlock - Unlock activity
 * - GET /api/v1/activities/:activityId/alternatives - Get alternatives
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface ActivityLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface Activity {
  id: string;
  itineraryId: string;
  title: string;
  type: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  location: ActivityLocation | null;
  address: string | null;
  blockOrder: number;
  locked: boolean;
  notes: string | null;
  tags: string[] | null;
  cost: number | null;
  currency: string | null;
  bookingStatus: string | null;
  addedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateActivityInput {
  title?: string;
  description?: string;
  startTime?: string; // HH:mm format
  endTime?: string;
  notes?: string;
  locked?: boolean;
  blockOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface MoveActivityInput {
  newItineraryId?: string;
  targetDayNumber?: number;
  newOrderIndex: number;
  newStartTime?: string;
  newEndTime?: string;
}

export interface ActivityUpdateResponse {
  activity: Activity;
}

export interface AlternativeActivity {
  activity: {
    id: string;
    title: string;
    type: string;
    description: string;
    startTime: string | null;
    endTime: string | null;
    location: ActivityLocation | null;
    tags: string[];
    price: {
      amount: number;
      currency: string;
    };
    duration: number;
    bookingUrl: string | null;
    imageUrl: string | null;
  };
  matchScore: number;
  matchReason: string;
}

export interface AlternativesResponse {
  alternatives: AlternativeActivity[];
  currentActivityId: string;
}

// ============================================================================
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  return { 'Content-Type': 'application/json' };
}

async function activitiesApiRequest<T>(
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
  
  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }
  
  return response.json();
}

// ============================================================================
// Trip Activities API
// ============================================================================

/**
 * Update an activity
 */
export async function updateActivity(
  activityId: string,
  input: UpdateActivityInput
): Promise<ActivityUpdateResponse> {
  return activitiesApiRequest<ActivityUpdateResponse>(`/${activityId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Delete an activity
 */
export async function deleteActivity(activityId: string): Promise<void> {
  await activitiesApiRequest<void>(`/${activityId}`, {
    method: 'DELETE',
  });
}

/**
 * Move an activity to a different day or position
 */
export async function moveActivity(
  activityId: string,
  input: MoveActivityInput
): Promise<ActivityUpdateResponse> {
  return activitiesApiRequest<ActivityUpdateResponse>(`/${activityId}/move`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Lock an activity (prevent changes)
 */
export async function lockActivity(activityId: string): Promise<ActivityUpdateResponse> {
  return activitiesApiRequest<ActivityUpdateResponse>(`/${activityId}/lock`, {
    method: 'PATCH',
  });
}

/**
 * Unlock an activity (allow changes)
 */
export async function unlockActivity(activityId: string): Promise<ActivityUpdateResponse> {
  return activitiesApiRequest<ActivityUpdateResponse>(`/${activityId}/unlock`, {
    method: 'PATCH',
  });
}

/**
 * Get alternative activities for an activity
 */
export async function getActivityAlternatives(
  activityId: string
): Promise<AlternativesResponse> {
  return activitiesApiRequest<AlternativesResponse>(`/${activityId}/alternatives`);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format time for display (HH:mm to 12h format)
 */
export function formatActivityTime(time: string | null): string {
  if (!time) return '';
  
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Get activity type icon (for lucide-react)
 */
export function getActivityTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    sightseeing: 'Camera',
    dining: 'Utensils',
    shopping: 'ShoppingBag',
    entertainment: 'Music',
    outdoor: 'Mountain',
    wellness: 'Heart',
    cultural: 'Landmark',
    tour: 'Map',
    transport: 'Car',
    rest: 'Coffee',
  };
  return icons[type.toLowerCase()] || 'MapPin';
}

// ============================================================================
// React Query Hooks
// ============================================================================

const activitiesKeys = {
  all: ['activities'] as const,
  alternatives: (activityId: string) => [...activitiesKeys.all, 'alternatives', activityId] as const,
};

export function useActivityAlternatives(activityId: string | null) {
  return useQuery({
    queryKey: activitiesKeys.alternatives(activityId || ''),
    queryFn: () => activityId ? getActivityAlternatives(activityId) : Promise.reject('No activity ID'),
    enabled: !!activityId,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ activityId, input }: { activityId: string; input: UpdateActivityInput }) =>
      updateActivity(activityId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itinerary'] });
      queryClient.invalidateQueries({ queryKey: ['trip'] });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itinerary'] });
      queryClient.invalidateQueries({ queryKey: ['trip'] });
    },
  });
}

export function useMoveActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ activityId, input }: { activityId: string; input: MoveActivityInput }) =>
      moveActivity(activityId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itinerary'] });
    },
  });
}

export function useLockActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: lockActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itinerary'] });
    },
  });
}

export function useUnlockActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: unlockActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itinerary'] });
    },
  });
}

// Default export
export default {
  updateActivity,
  deleteActivity,
  moveActivity,
  lockActivity,
  unlockActivity,
  getActivityAlternatives,
  formatActivityTime,
  getActivityTypeIcon,
};
