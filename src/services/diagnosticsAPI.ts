/**
 * Diagnostics API Service
 * 
 * System diagnostics, user profile diagnostics, and duplicate detection.
 * Matches backend: diagnostics routes
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// TYPES
// ============================================================================

export interface ProfileCompleteness {
  hasPreferences: boolean;
  hasCustomizedActivities: boolean;
  hasSetRegions: boolean;
  hasSetTravelStyle: boolean;
  hasName: boolean;
  hasHandle: boolean;
  completionPercentage: number;
}

export interface UserPreferenceSummary {
  id: string;
  travelStyle: string | null;
  budget: string | null;
  pace: string | null;
  preferredRegions: string[] | null;
  flightPreferences: Record<string, unknown> | null;
  dietaryRestrictions: string[] | null;
  hasActivities: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserDiagnostics {
  userId: string;
  email: string;
  provider: string | null;
  hasPassword: boolean;
  createdAt: string;
  lastLogin: string | null;
  profile: {
    name: string | null;
    handle: string | null;
  };
  preferences: UserPreferenceSummary | null;
  completeness: ProfileCompleteness;
  recommendations: string[];
}

export interface UserDiagnosticsResponse {
  success: boolean;
  diagnostics: UserDiagnostics;
}

export interface SystemStatusResponse {
  status: 'ok' | 'error';
  timestamp: string;
  databaseConnected: boolean;
  message?: string;
  error?: string;
}

export interface DuplicateEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateCheckResponse {
  status: 'ok' | 'error';
  userId?: string;
  count?: number;
  entries?: DuplicateEntry[];
  hasDuplicates?: boolean;
  duplicateUsers?: Array<{ userId: string; count: number }>;
  message?: string;
  error?: string;
}

export interface FixDuplicatesResponse {
  status: 'ok' | 'error';
  message: string;
  userId: string;
  originalCount?: number;
  deletedCount?: number;
  keptEntryId?: string;
  count?: number;
  error?: string;
}

// ============================================================================
// API HELPERS
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

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get system status (database connectivity check)
 */
export async function getSystemStatus(): Promise<SystemStatusResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/diagnostics/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get system status' }));
    throw new Error(error.error || error.message || 'Failed to get system status');
  }

  return response.json();
}

/**
 * Get user diagnostics by user ID
 */
export async function getUserDiagnostics(userId: string): Promise<UserDiagnosticsResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/diagnostics/user/${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get user diagnostics' }));
    throw new Error(error.error || error._error || error.message || 'Failed to get user diagnostics');
  }

  return response.json();
}

/**
 * Get current user diagnostics (requires auth)
 */
export async function getMyDiagnostics(): Promise<UserDiagnosticsResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/diagnostics/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get diagnostics' }));
    throw new Error(error.error || error._error || error.message || 'Failed to get diagnostics');
  }

  return response.json();
}

/**
 * Check for duplicate preferences entries
 */
export async function checkDuplicates(userId?: string): Promise<DuplicateCheckResponse> {
  const headers = await getAuthHeader();
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';

  const response = await fetch(`${API_BASE_URL}/api/v1/diagnostics/duplicate-check${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to check duplicates' }));
    throw new Error(error.error || error._error || error.message || 'Failed to check duplicates');
  }

  return response.json();
}

/**
 * Fix duplicate preferences for a user
 */
export async function fixDuplicates(userId: string): Promise<FixDuplicatesResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/diagnostics/fix-duplicates/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fix duplicates' }));
    throw new Error(error.error || error._error || error.message || 'Failed to fix duplicates');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useSystemStatus() {
  return useQuery({
    queryKey: ['system-status'],
    queryFn: getSystemStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useUserDiagnostics(userId: string | null) {
  return useQuery({
    queryKey: ['user-diagnostics', userId],
    queryFn: () => getUserDiagnostics(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useMyDiagnostics() {
  return useQuery({
    queryKey: ['my-diagnostics'],
    queryFn: getMyDiagnostics,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDuplicateCheck(userId?: string) {
  return useQuery({
    queryKey: ['duplicate-check', userId],
    queryFn: () => checkDuplicates(userId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useFixDuplicates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fixDuplicates,
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-check', userId] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-check'] });
      queryClient.invalidateQueries({ queryKey: ['user-diagnostics', userId] });
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getCompletionLabel(percentage: number): string {
  if (percentage >= 100) return 'Complete';
  if (percentage >= 80) return 'Almost complete';
  if (percentage >= 60) return 'Mostly complete';
  if (percentage >= 40) return 'In progress';
  if (percentage >= 20) return 'Getting started';
  return 'Just started';
}

export function getCompletionColor(percentage: number): string {
  if (percentage >= 100) return 'text-green-600';
  if (percentage >= 80) return 'text-emerald-600';
  if (percentage >= 60) return 'text-yellow-600';
  if (percentage >= 40) return 'text-orange-600';
  return 'text-red-600';
}

export function getStatusIndicator(connected: boolean): {
  label: string;
  color: string;
  icon: string;
} {
  if (connected) {
    return {
      label: 'Connected',
      color: 'text-green-600',
      icon: '✓',
    };
  }
  return {
    label: 'Disconnected',
    color: 'text-red-600',
    icon: '✗',
  };
}

export function formatRecommendations(recommendations: string[]): string[] {
  // Filter and format recommendations for display
  return recommendations.filter((r) => r && r.trim().length > 0);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

const diagnosticsAPI = {
  getSystemStatus,
  getUserDiagnostics,
  getMyDiagnostics,
  checkDuplicates,
  fixDuplicates,
};

export default diagnosticsAPI;
