/**
 * Voyance Emotional Tags API Service
 * 
 * Integrates with Railway backend emotional tags endpoints:
 * - POST /api/v1/emotion/:tripId/add-tag - Add emotional tag
 * - POST /api/v1/emotion/:tripId/remove-tag - Remove emotional tag
 * - GET /api/v1/emotion/:tripId/tags - Get all tags for trip
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface EmotionalTag {
  day: string; // YYYY-MM-DD
  label: string;
  notes?: string;
}

export interface AddTagInput {
  tripId: string;
  tag: EmotionalTag;
}

export interface RemoveTagInput {
  tripId: string;
  day: string;
  label: string;
}

export interface TagsResponse {
  success: boolean;
  tags?: string[];
  parsedTags?: EmotionalTag[];
  error?: string;
}

export interface AddTagResponse {
  success: boolean;
  tags?: string[];
  message?: string;
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

async function emotionApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/emotion${endpoint}`, {
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
// Emotional Tags API
// ============================================================================

/**
 * Get all emotional tags for a trip
 */
export async function getEmotionalTags(tripId: string): Promise<TagsResponse> {
  try {
    const response = await emotionApiRequest<TagsResponse>(`/${tripId}/tags`, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[EmotionalTagsAPI] Get tags error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tags',
    };
  }
}

/**
 * Add an emotional tag to a trip day
 */
export async function addEmotionalTag(input: AddTagInput): Promise<AddTagResponse> {
  try {
    const response = await emotionApiRequest<AddTagResponse>(`/${input.tripId}/add-tag`, {
      method: 'POST',
      body: JSON.stringify(input.tag),
    });
    return response;
  } catch (error) {
    console.error('[EmotionalTagsAPI] Add tag error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add tag',
    };
  }
}

/**
 * Remove an emotional tag from a trip
 */
export async function removeEmotionalTag(input: RemoveTagInput): Promise<AddTagResponse> {
  try {
    const response = await emotionApiRequest<AddTagResponse>(`/${input.tripId}/remove-tag`, {
      method: 'POST',
      body: JSON.stringify({ day: input.day, label: input.label }),
    });
    return response;
  } catch (error) {
    console.error('[EmotionalTagsAPI] Remove tag error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove tag',
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse a tag string (format: "YYYY-MM-DD:label:notes") into an object
 */
export function parseTagString(tagString: string): EmotionalTag | null {
  const parts = tagString.split(':');
  if (parts.length < 2) return null;
  
  return {
    day: parts[0],
    label: parts[1],
    notes: parts[2] || undefined,
  };
}

/**
 * Format a tag object into a string
 */
export function formatTagString(tag: EmotionalTag): string {
  let str = `${tag.day}:${tag.label}`;
  if (tag.notes) str += `:${tag.notes}`;
  return str;
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useEmotionalTags(tripId: string | null) {
  return useQuery({
    queryKey: ['emotional-tags', tripId],
    queryFn: () => tripId ? getEmotionalTags(tripId) : Promise.reject('No trip'),
    enabled: !!tripId,
    staleTime: 60_000,
  });
}

export function useAddEmotionalTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addEmotionalTag,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['emotional-tags', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', variables.tripId] });
    },
  });
}

export function useRemoveEmotionalTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: removeEmotionalTag,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['emotional-tags', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', variables.tripId] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const emotionalTagsAPI = {
  getEmotionalTags,
  addEmotionalTag,
  removeEmotionalTag,
  parseTagString,
  formatTagString,
};

export default emotionalTagsAPI;
