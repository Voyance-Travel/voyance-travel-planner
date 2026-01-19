/**
 * Voyance DreamBuilder API Service
 * 
 * Integrates with Railway backend DreamBuilder endpoints:
 * - POST /api/v1/dreambuilder/submit - Submit dream trip preferences
 * - GET /api/v1/dreambuilder/match/:userId - Get cached dream match
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface DreamBuilderInput {
  tripStyle: string;
  destinationPreferences: string[];
  travelPartySize: number;
  tripLengthDays: number;
  budgetLevel: string;
}

export interface DreamMatchDestination {
  id: string;
  name: string;
  country: string;
  matchScore: number;
  matchReasons: string[];
  imageUrl?: string;
  description?: string;
}

export interface DreamMatchResult {
  destinations: DreamMatchDestination[];
  topMatch?: DreamMatchDestination;
  confidenceScore: number;
  generatedAt: string;
}

export interface DreamBuilderSubmitResponse {
  success: boolean;
  matchId?: string;
  match?: DreamMatchResult;
  message?: string;
  error?: string;
}

export interface DreamMatchResponse {
  match: DreamMatchResult;
  confidenceScore: number;
  createdAt: string;
}

export interface DreamBuilderHealthResponse {
  status: string;
  message: string;
  aiWorker?: string;
  reason?: string;
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

async function dreamBuilderApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/dreambuilder${endpoint}`, {
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
// DreamBuilder API
// ============================================================================

/**
 * Check DreamBuilder health status
 */
export async function getDreamBuilderHealth(): Promise<DreamBuilderHealthResponse> {
  try {
    const response = await dreamBuilderApiRequest<DreamBuilderHealthResponse>('/', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[DreamBuilderAPI] Health check error:', error);
    throw error;
  }
}

/**
 * Submit dream trip preferences for AI matching
 */
export async function submitDreamBuilder(
  input: DreamBuilderInput
): Promise<DreamBuilderSubmitResponse> {
  try {
    const response = await dreamBuilderApiRequest<DreamBuilderSubmitResponse>('/submit', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[DreamBuilderAPI] Submit error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit dream builder',
    };
  }
}

/**
 * Get cached dream match for a user
 */
export async function getDreamMatch(userId: string): Promise<DreamMatchResponse> {
  try {
    const response = await dreamBuilderApiRequest<DreamMatchResponse>(`/match/${userId}`, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[DreamBuilderAPI] Get match error:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useDreamBuilderHealth() {
  return useQuery({
    queryKey: ['dreambuilder-health'],
    queryFn: getDreamBuilderHealth,
    staleTime: 5 * 60_000, // 5 minutes
    retry: 1,
  });
}

export function useDreamMatch(userId: string | null) {
  return useQuery({
    queryKey: ['dream-match', userId],
    queryFn: () => userId ? getDreamMatch(userId) : Promise.reject('No user ID'),
    enabled: !!userId,
    staleTime: 10 * 60_000, // 10 minutes
  });
}

export function useSubmitDreamBuilder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: submitDreamBuilder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dream-match'] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const dreamBuilderAPI = {
  getDreamBuilderHealth,
  submitDreamBuilder,
  getDreamMatch,
};

export default dreamBuilderAPI;
