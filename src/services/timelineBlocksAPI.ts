/**
 * Voyance Timeline Blocks API Service
 * 
 * Integrates with Railway backend timeline endpoints:
 * - GET /timeline/trip/:tripId - Get timeline blocks for a trip
 * - POST /timeline/:tripId/add-block - Add a new timeline block
 * - PATCH /timeline/:tripId/update-block/:blockId - Update a timeline block
 * - DELETE /timeline/:tripId/delete-block/:blockId - Delete a timeline block
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface ActivityBlock {
  id?: string;
  name: string;
  description?: string;
  location?: string;
  duration?: number; // minutes
  startTime?: string;
  endTime?: string;
  type?: 'activity' | 'meal' | 'transit' | 'rest';
  cost?: number;
  notes?: string;
}

export interface TransportMode {
  type: 'walking' | 'driving' | 'public_transport' | 'taxi' | 'bike' | 'other';
  duration?: number;
  distance?: number;
  cost?: number;
  notes?: string;
}

export interface TimelineBlock {
  id: string;
  tripId: string;
  day: string; // YYYY-MM-DD format
  morningActivity?: ActivityBlock | null;
  afternoonActivity?: ActivityBlock | null;
  eveningActivity?: ActivityBlock | null;
  transportMode?: TransportMode | null;
  mealsIncluded?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTimelineBlockInput {
  day: string; // YYYY-MM-DD format
  morningActivity?: ActivityBlock;
  afternoonActivity?: ActivityBlock;
  eveningActivity?: ActivityBlock;
  transportMode?: TransportMode;
  mealsIncluded?: string[];
}

export interface UpdateTimelineBlockInput {
  day?: string;
  morningActivity?: ActivityBlock;
  afternoonActivity?: ActivityBlock;
  eveningActivity?: ActivityBlock;
  transportMode?: TransportMode;
  mealsIncluded?: string[];
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

async function timelineApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/timeline${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData._error || errorData.error || `HTTP ${response.status}`);
  }
  
  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }
  
  return response.json();
}

// ============================================================================
// Timeline Blocks API
// ============================================================================

/**
 * Get all timeline blocks for a trip
 */
export async function getTimelineBlocks(tripId: string): Promise<TimelineBlock[]> {
  return timelineApiRequest<TimelineBlock[]>(`/trip/${tripId}`);
}

/**
 * Add a new timeline block to a trip
 */
export async function addTimelineBlock(
  tripId: string,
  block: CreateTimelineBlockInput
): Promise<TimelineBlock> {
  return timelineApiRequest<TimelineBlock>(`/${tripId}/add-block`, {
    method: 'POST',
    body: JSON.stringify(block),
  });
}

/**
 * Update an existing timeline block
 */
export async function updateTimelineBlock(
  tripId: string,
  blockId: string,
  updates: UpdateTimelineBlockInput
): Promise<TimelineBlock> {
  return timelineApiRequest<TimelineBlock>(`/${tripId}/update-block/${blockId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a timeline block
 */
export async function deleteTimelineBlock(
  tripId: string,
  blockId: string
): Promise<void> {
  await timelineApiRequest<void>(`/${tripId}/delete-block/${blockId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// React Query Hooks
// ============================================================================

const timelineKeys = {
  all: ['timeline-blocks'] as const,
  trip: (tripId: string) => [...timelineKeys.all, 'trip', tripId] as const,
};

export function useTimelineBlocks(tripId: string | null) {
  return useQuery({
    queryKey: timelineKeys.trip(tripId || ''),
    queryFn: () => tripId ? getTimelineBlocks(tripId) : Promise.resolve([]),
    enabled: !!tripId,
    staleTime: 2 * 60_000, // 2 minutes
  });
}

export function useAddTimelineBlock() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, block }: { tripId: string; block: CreateTimelineBlockInput }) =>
      addTimelineBlock(tripId, block),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: timelineKeys.trip(variables.tripId) });
    },
  });
}

export function useUpdateTimelineBlock() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, blockId, updates }: { 
      tripId: string; 
      blockId: string; 
      updates: UpdateTimelineBlockInput 
    }) => updateTimelineBlock(tripId, blockId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: timelineKeys.trip(variables.tripId) });
    },
  });
}

export function useDeleteTimelineBlock() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, blockId }: { tripId: string; blockId: string }) =>
      deleteTimelineBlock(tripId, blockId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: timelineKeys.trip(variables.tripId) });
    },
  });
}

// Default export
export default {
  getTimelineBlocks,
  addTimelineBlock,
  updateTimelineBlock,
  deleteTimelineBlock,
};
