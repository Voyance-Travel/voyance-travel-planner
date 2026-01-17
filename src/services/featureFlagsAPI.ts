/**
 * Feature Flags API Service
 * 
 * Handles feature flag management for users and admins.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export const KNOWN_FLAGS = [
  'beta-features',
  'new-ui',
  'ai-suggestions',
  'premium-features',
  'experimental-search',
  'debug-mode',
  'maintenance-mode',
] as const;

export type KnownFlag = typeof KNOWN_FLAGS[number];

export interface FeatureFlag {
  flag: string;
  enabled: boolean;
  expiresAt?: string;
}

export interface UserFlagsResponse {
  userId: string;
  flags: FeatureFlag[];
}

export interface SetFlagInput {
  userId: string;
  flag: string;
  enabled: boolean;
  ttlSeconds?: number;
}

export interface AdminFlag {
  id: string;
  userId: string;
  flag: string;
  enabled: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AllFlagsResponse {
  flags: AdminFlag[];
  total: number;
  limit: number;
  offset: number;
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
 * Get feature flags for a user
 */
export async function getUserFlags(userId: string): Promise<UserFlagsResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/featureFlags/${userId}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch feature flags');
  }

  return response.json();
}

/**
 * Set a feature flag (admin only)
 */
export async function setFeatureFlag(input: SetFlagInput): Promise<{ success: boolean; flag: FeatureFlag }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/featureFlags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Set failed' }));
    throw new Error(error.error || 'Failed to set feature flag');
  }

  return response.json();
}

/**
 * Delete a feature flag (admin only)
 */
export async function deleteFeatureFlag(
  userId: string,
  flag: string
): Promise<{ success: boolean; message: string }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/featureFlags/${userId}/${flag}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(error.error || 'Failed to delete feature flag');
  }

  return response.json();
}

/**
 * Get all feature flags (admin only)
 */
export async function getAllFlags(params?: {
  limit?: number;
  offset?: number;
}): Promise<AllFlagsResponse> {
  const headers = await getAuthHeader();
  const queryParams = new URLSearchParams();

  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());

  const url = `${API_BASE_URL}/api/v1/featureFlags/all${queryParams.toString() ? `?${queryParams}` : ''}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch all feature flags');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useUserFlags(userId: string | null) {
  return useQuery({
    queryKey: ['feature-flags', userId],
    queryFn: () => getUserFlags(userId!),
    enabled: !!userId,
    staleTime: 60000,
  });
}

export function useSetFeatureFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setFeatureFlag,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags', 'all'] });
    },
  });
}

export function useDeleteFeatureFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, flag }: { userId: string; flag: string }) =>
      deleteFeatureFlag(userId, flag),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags', userId] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags', 'all'] });
    },
  });
}

export function useAllFlags(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['feature-flags', 'all', params],
    queryFn: () => getAllFlags(params),
    staleTime: 30000,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isFlagEnabled(flags: FeatureFlag[], flagName: string): boolean {
  const flag = flags.find((f) => f.flag === flagName);
  return flag?.enabled ?? false;
}

export function getFlagValue(flags: FeatureFlag[], flagName: string): FeatureFlag | undefined {
  return flags.find((f) => f.flag === flagName);
}
