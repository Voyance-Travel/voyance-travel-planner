/**
 * Voyance Must-Haves API Service
 * 
 * Integrates with Railway backend must-haves endpoints:
 * - GET /api/v1/must-haves/:tripId - Get all must-haves for a trip
 * - POST /api/v1/must-haves/:tripId - Add a must-have item
 * - PUT /api/v1/must-haves/:tripId/:mustHaveId - Update a must-have
 * - DELETE /api/v1/must-haves/:tripId/:mustHaveId - Delete a must-have
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface MustHave {
  id: string;
  tripId: string;
  label: string;
  notes?: string;
  aiGenerated: boolean;
  userModified: boolean;
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMustHaveInput {
  tripId: string;
  label: string;
  notes?: string;
  aiGenerated?: boolean;
  userModified?: boolean;
}

export interface UpdateMustHaveInput {
  tripId: string;
  mustHaveId: string;
  label?: string;
  notes?: string;
  completed?: boolean;
  userModified?: boolean;
}

export interface DeleteMustHaveInput {
  tripId: string;
  mustHaveId: string;
}

export interface MustHavesResponse {
  success: boolean;
  mustHaves?: MustHave[];
  error?: string;
}

export interface MustHaveResponse {
  success: boolean;
  mustHave?: MustHave;
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

async function mustHavesApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/must-haves${endpoint}`, {
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
// Must-Haves API
// ============================================================================

/**
 * Get all must-haves for a trip
 */
export async function getMustHaves(tripId: string): Promise<MustHave[]> {
  try {
    const response = await mustHavesApiRequest<MustHave[]>(`/${tripId}`, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[MustHavesAPI] Get error:', error);
    throw error;
  }
}

/**
 * Add a must-have item to a trip
 */
export async function createMustHave(input: CreateMustHaveInput): Promise<MustHave> {
  try {
    const { tripId, ...body } = input;
    const response = await mustHavesApiRequest<MustHave>(`/${tripId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response;
  } catch (error) {
    console.error('[MustHavesAPI] Create error:', error);
    throw error;
  }
}

/**
 * Update a must-have item
 */
export async function updateMustHave(input: UpdateMustHaveInput): Promise<MustHave> {
  try {
    const { tripId, mustHaveId, ...body } = input;
    const response = await mustHavesApiRequest<MustHave>(`/${tripId}/${mustHaveId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return response;
  } catch (error) {
    console.error('[MustHavesAPI] Update error:', error);
    throw error;
  }
}

/**
 * Delete a must-have item
 */
export async function deleteMustHave(input: DeleteMustHaveInput): Promise<{ success: boolean }> {
  try {
    const response = await mustHavesApiRequest<{ success: boolean }>(
      `/${input.tripId}/${input.mustHaveId}`,
      { method: 'DELETE' }
    );
    return response;
  } catch (error) {
    console.error('[MustHavesAPI] Delete error:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useMustHaves(tripId: string | null) {
  return useQuery({
    queryKey: ['must-haves', tripId],
    queryFn: () => tripId ? getMustHaves(tripId) : Promise.reject('No trip'),
    enabled: !!tripId,
    staleTime: 60_000,
  });
}

export function useCreateMustHave() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createMustHave,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['must-haves', variables.tripId] });
    },
  });
}

export function useUpdateMustHave() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateMustHave,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['must-haves', variables.tripId] });
    },
  });
}

export function useDeleteMustHave() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteMustHave,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['must-haves', variables.tripId] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const mustHavesAPI = {
  getMustHaves,
  createMustHave,
  updateMustHave,
  deleteMustHave,
};

export default mustHavesAPI;
