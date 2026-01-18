/**
 * Diagnostics API Service
 * 
 * User profile diagnostics using Supabase directly.
 * System diagnostics use local checks.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
// API FUNCTIONS
// ============================================================================

/**
 * Get system status - checks Supabase connectivity
 */
export async function getSystemStatus(): Promise<SystemStatusResponse> {
  try {
    // Simple connectivity check
    const { error } = await supabase.from('destinations').select('id').limit(1);
    
    return {
      status: error ? 'error' : 'ok',
      timestamp: new Date().toISOString(),
      databaseConnected: !error,
      message: error ? error.message : 'All systems operational',
    };
  } catch (err) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      databaseConnected: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get user diagnostics by user ID (admin only - returns current user if not admin)
 */
export async function getUserDiagnostics(userId: string): Promise<UserDiagnosticsResponse> {
  // For non-admin users, just return their own diagnostics
  return getMyDiagnostics();
}

/**
 * Get current user diagnostics
 */
export async function getMyDiagnostics(): Promise<UserDiagnosticsResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const [profileResult, preferencesResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
  ]);
  
  const profile = profileResult.data;
  const preferences = preferencesResult.data;
  
  // Calculate completeness
  const hasPreferences = !!preferences;
  const hasSetTravelStyle = !!preferences?.travel_style;
  const hasSetRegions = (preferences?.preferred_regions?.length || 0) > 0;
  const hasName = !!profile?.display_name;
  const hasHandle = !!profile?.handle;
  
  const checks = [hasPreferences, hasSetTravelStyle, hasSetRegions, hasName, hasHandle];
  const completionPercentage = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (!hasName) recommendations.push('Add a display name to personalize your profile');
  if (!hasHandle) recommendations.push('Set a unique handle for your profile URL');
  if (!hasSetTravelStyle) recommendations.push('Complete the travel style quiz for better recommendations');
  if (!hasSetRegions) recommendations.push('Add your preferred travel regions');
  
  return {
    success: true,
    diagnostics: {
      userId: user.id,
      email: user.email || '',
      provider: user.app_metadata?.provider || null,
      hasPassword: !!user.email, // Simplified check
      createdAt: user.created_at,
      lastLogin: user.last_sign_in_at || null,
      profile: {
        name: profile?.display_name || null,
        handle: profile?.handle || null,
      },
      preferences: preferences ? {
        id: preferences.id,
        travelStyle: preferences.travel_style,
        budget: preferences.budget_tier,
        pace: preferences.travel_pace,
        preferredRegions: preferences.preferred_regions,
        flightPreferences: preferences.flight_preferences as Record<string, unknown> | null,
        dietaryRestrictions: preferences.dietary_restrictions,
        hasActivities: !!preferences.activity_weights,
        createdAt: preferences.created_at,
        updatedAt: preferences.updated_at,
      } : null,
      completeness: {
        hasPreferences,
        hasCustomizedActivities: !!preferences?.activity_weights,
        hasSetRegions,
        hasSetTravelStyle,
        hasName,
        hasHandle,
        completionPercentage,
      },
      recommendations,
    },
  };
}

/**
 * Check for duplicate preferences entries
 */
export async function checkDuplicates(userId?: string): Promise<DuplicateCheckResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const targetUserId = userId || user.id;
  
  const { data, error } = await supabase
    .from('user_preferences')
    .select('id, created_at, updated_at')
    .eq('user_id', targetUserId);
  
  if (error) {
    return { status: 'error', error: error.message };
  }
  
  const count = data?.length || 0;
  
  return {
    status: 'ok',
    userId: targetUserId,
    count,
    entries: data?.map(d => ({
      id: d.id,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    })) || [],
    hasDuplicates: count > 1,
  };
}

/**
 * Fix duplicate preferences for a user
 */
export async function fixDuplicates(userId: string): Promise<FixDuplicatesResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  // Get all entries for user
  const { data: entries, error } = await supabase
    .from('user_preferences')
    .select('id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    return { status: 'error', message: error.message, userId, error: error.message };
  }
  
  if (!entries || entries.length <= 1) {
    return {
      status: 'ok',
      message: 'No duplicates found',
      userId,
      count: entries?.length || 0,
    };
  }
  
  // Keep the most recent, delete the rest
  const [keep, ...remove] = entries;
  const idsToRemove = remove.map(e => e.id);
  
  const { error: deleteError } = await supabase
    .from('user_preferences')
    .delete()
    .in('id', idsToRemove);
  
  if (deleteError) {
    return { status: 'error', message: deleteError.message, userId, error: deleteError.message };
  }
  
  return {
    status: 'ok',
    message: `Removed ${idsToRemove.length} duplicate entries`,
    userId,
    originalCount: entries.length,
    deletedCount: idsToRemove.length,
    keptEntryId: keep.id,
  };
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useSystemStatus() {
  return useQuery({
    queryKey: ['system-status'],
    queryFn: getSystemStatus,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useUserDiagnostics(userId: string | null) {
  return useQuery({
    queryKey: ['user-diagnostics', userId],
    queryFn: () => getUserDiagnostics(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
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
    staleTime: 10 * 60 * 1000,
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
