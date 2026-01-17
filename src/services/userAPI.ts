/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Voyance User API
 * 
 * User-related endpoints:
 * - GET /api/v1/user/stats/trips - Comprehensive trip statistics
 * - GET /api/v1/user/stats/trips/summary - Lightweight trip summary
 * - GET /api/v1/user/profile/trips - Trip data for profile display
 * - GET /api/v1/user/profile/trips/statistics - Trip statistics
 * - GET /api/v1/user/profile/trips/next - Next upcoming trip
 * - GET /api/v1/user/profile/trips/recent - Recent trip cards
 * - GET /api/v1/user/profile/trips/milestones - Travel milestones
 * - GET /api/v1/user/onboarding - Onboarding status
 * - POST /api/v1/user/onboarding/guide-completed - Mark guide as seen
 * - POST /api/v1/user/onboarding/milestone - Track milestone
 */

import { supabase } from '@/integrations/supabase/client';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface TripStats {
  totalTrips: number;
  completedTrips: number;
  upcomingTrips: number;
  draftTrips: number;
  totalCountries: number;
  totalCities: number;
  countriesVisited: string[];
  citiesVisited: string[];
  totalDaysAbroad: number;
  averageTripLength: number;
  travelFrequency: 'new' | 'occasional' | 'regular' | 'frequent' | 'nomadic';
  profileStatus: 'planning' | 'adventurer' | 'traveler' | 'explorer';
  isEmpty: boolean;
  isNewTraveler: boolean;
  hasUpcomingAdventures: boolean;
  summaryText: string;
}

export interface TripStatsSummary {
  totalTrips: number;
  completedTrips: number;
  upcomingTrips: number;
  hasTrips: boolean;
  displayText: string;
}

export interface TripProfileData {
  totalTrips: number;
  completedTrips: number;
  upcomingTrips: number;
  draftTrips: number;
  countriesVisited: string[];
  continentsVisited: string[];
  totalDaysTravel: number;
  travelFrequency: string;
  nextTrip: TripCard | null;
  recentTrips: TripCard[];
  tripPlanningMilestones: {
    hasCompletedTrip: boolean;
    hasInternationalTrip: boolean;
    hasMultiCityTrip: boolean;
    hasLongTripPlan: boolean;
  };
}

export interface TripCard {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  imageUrl?: string;
}

export interface TripStatistics {
  totalTrips: number;
  completedTrips: number;
  upcomingTrips: number;
  draftTrips: number;
  countriesVisited: number;
  totalDaysTravel: number;
  travelFrequency: string;
  hasAnyTrips: boolean;
  hasCompletedTrips: boolean;
  isNewTraveler: boolean;
  isActivePlanner: boolean;
}

export interface TripMilestones {
  hasCompletedTrip: boolean;
  hasInternationalTrip: boolean;
  hasMultiCityTrip: boolean;
  hasLongTripPlan: boolean;
}

export interface Achievements {
  firstTrip: boolean;
  globalExplorer: boolean;
  cityHopper: boolean;
  adventurePlanner: boolean;
  frequentTraveler: boolean;
  countryCollector: boolean;
  continentExplorer: boolean;
}

export interface OnboardingStatus {
  isNewUser: boolean;
  shouldShowProfileGuide: boolean;
  quizCompleted: boolean;
  onboardingCompleted: boolean;
  hasCreatedTrips: boolean;
  accountAge: number;
  milestones: {
    quiz: boolean;
    profile: boolean;
    firstTrip: boolean;
    profileGuide: boolean;
  };
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

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
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
// Trip Stats API
// ============================================================================

/**
 * Get comprehensive trip statistics
 */
export async function getTripStats(): Promise<{ success: boolean; stats?: TripStats; error?: string }> {
  try {
    const response = await apiRequest<{ success: boolean; stats: TripStats }>('/api/v1/user/stats/trips', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[UserAPI] Get trip stats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get trip stats',
    };
  }
}

/**
 * Get lightweight trip summary
 */
export async function getTripSummary(): Promise<{ success: boolean; summary?: TripStatsSummary; error?: string }> {
  try {
    const response = await apiRequest<{ success: boolean; summary: TripStatsSummary }>('/api/v1/user/stats/trips/summary', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[UserAPI] Get trip summary error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get trip summary',
    };
  }
}

// ============================================================================
// Profile Trips API
// ============================================================================

/**
 * Get trip data for profile display
 */
export async function getProfileTrips(): Promise<{
  success: boolean;
  data?: TripProfileData;
  meta?: {
    hasTrips: boolean;
    hasCompletedTrips: boolean;
    hasUpcomingTrips: boolean;
    isEmpty: boolean;
    shouldShowEmptyState: boolean;
    dataFreshness: string;
  };
  error?: string;
}> {
  try {
    const response = await apiRequest<{
      success: boolean;
      data: TripProfileData;
      meta: {
        hasTrips: boolean;
        hasCompletedTrips: boolean;
        hasUpcomingTrips: boolean;
        isEmpty: boolean;
        shouldShowEmptyState: boolean;
        dataFreshness: string;
      };
    }>('/api/v1/user/profile/trips', { method: 'GET' });
    return response;
  } catch (error) {
    console.error('[UserAPI] Get profile trips error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get profile trips',
    };
  }
}

/**
 * Get trip statistics for profile
 */
export async function getProfileTripStatistics(): Promise<{
  success: boolean;
  statistics?: TripStatistics;
  error?: string;
}> {
  try {
    const response = await apiRequest<{ success: boolean; statistics: TripStatistics }>('/api/v1/user/profile/trips/statistics', { method: 'GET' });
    return response;
  } catch (error) {
    console.error('[UserAPI] Get trip statistics error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get trip statistics',
    };
  }
}

/**
 * Get next upcoming trip
 */
export async function getNextTrip(): Promise<{
  success: boolean;
  nextTrip?: TripCard | null;
  hasNextTrip?: boolean;
  error?: string;
}> {
  try {
    const response = await apiRequest<{
      success: boolean;
      nextTrip: TripCard | null;
      hasNextTrip: boolean;
    }>('/api/v1/user/profile/trips/next', { method: 'GET' });
    return response;
  } catch (error) {
    console.error('[UserAPI] Get next trip error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get next trip',
    };
  }
}

/**
 * Get recent trips
 */
export async function getRecentTrips(limit: number = 6): Promise<{
  success: boolean;
  recentTrips?: TripCard[];
  totalCount?: number;
  hasMore?: boolean;
  error?: string;
}> {
  try {
    const response = await apiRequest<{
      success: boolean;
      recentTrips: TripCard[];
      totalCount: number;
      hasMore: boolean;
    }>(`/api/v1/user/profile/trips/recent?limit=${limit}`, { method: 'GET' });
    return response;
  } catch (error) {
    console.error('[UserAPI] Get recent trips error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recent trips',
    };
  }
}

/**
 * Get travel milestones
 */
export async function getTripMilestones(): Promise<{
  success: boolean;
  milestones?: TripMilestones;
  achievements?: Achievements;
  profileProgress?: {
    travelExperience: number;
    worldCoverage: number;
    planningExpertise: number;
  };
  error?: string;
}> {
  try {
    const response = await apiRequest<{
      success: boolean;
      milestones: TripMilestones;
      achievements: Achievements;
      profileProgress: {
        travelExperience: number;
        worldCoverage: number;
        planningExpertise: number;
      };
    }>('/api/v1/user/profile/trips/milestones', { method: 'GET' });
    return response;
  } catch (error) {
    console.error('[UserAPI] Get milestones error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get milestones',
    };
  }
}

// ============================================================================
// Onboarding API
// ============================================================================

/**
 * Get onboarding status
 */
export async function getOnboardingStatus(): Promise<{
  success: boolean;
  onboarding?: OnboardingStatus;
  error?: string;
}> {
  try {
    const response = await apiRequest<{ success: boolean; onboarding: OnboardingStatus }>('/api/v1/user/onboarding', { method: 'GET' });
    return response;
  } catch (error) {
    console.error('[UserAPI] Get onboarding status error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get onboarding status',
    };
  }
}

/**
 * Mark profile guide as completed
 */
export async function completeProfileGuide(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await apiRequest<{ success: boolean; message: string }>('/api/v1/user/onboarding/guide-completed', {
      method: 'POST',
    });
    return response;
  } catch (error) {
    console.error('[UserAPI] Complete guide error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete guide',
    };
  }
}

/**
 * Track onboarding milestone
 */
export async function trackMilestone(milestone: string): Promise<{
  success: boolean;
  milestone?: string;
  completedAt?: string;
  error?: string;
}> {
  try {
    const response = await apiRequest<{
      success: boolean;
      milestone: string;
      completedAt: string;
    }>('/api/v1/user/onboarding/milestone', {
      method: 'POST',
      body: JSON.stringify({ milestone }),
    });
    return response;
  } catch (error) {
    console.error('[UserAPI] Track milestone error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to track milestone',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useTripStats() {
  return useQuery({
    queryKey: ['trip-stats'],
    queryFn: getTripStats,
    staleTime: 60_000,
  });
}

export function useTripSummary() {
  return useQuery({
    queryKey: ['trip-summary'],
    queryFn: getTripSummary,
    staleTime: 60_000,
  });
}

export function useProfileTrips() {
  return useQuery({
    queryKey: ['profile-trips'],
    queryFn: getProfileTrips,
    staleTime: 60_000,
  });
}

export function useProfileTripStatistics() {
  return useQuery({
    queryKey: ['profile-trip-statistics'],
    queryFn: getProfileTripStatistics,
    staleTime: 60_000,
  });
}

export function useNextTrip() {
  return useQuery({
    queryKey: ['next-trip'],
    queryFn: getNextTrip,
    staleTime: 60_000,
  });
}

export function useRecentTrips(limit: number = 6) {
  return useQuery({
    queryKey: ['recent-trips', limit],
    queryFn: () => getRecentTrips(limit),
    staleTime: 60_000,
  });
}

export function useTripMilestones() {
  return useQuery({
    queryKey: ['trip-milestones'],
    queryFn: getTripMilestones,
    staleTime: 5 * 60_000,
  });
}

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ['onboarding-status'],
    queryFn: getOnboardingStatus,
    staleTime: 5 * 60_000,
  });
}

export function useCompleteProfileGuide() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: completeProfileGuide,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
  });
}

export function useTrackMilestone() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (milestone: string) => trackMilestone(milestone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      queryClient.invalidateQueries({ queryKey: ['trip-milestones'] });
    },
  });
}

// ============================================================================
// Profile Completion API
// ============================================================================

export interface ProfileCompletionSection {
  name: string;
  weight: number;
  completed: boolean;
  progress: number;
}

export interface ProfileCompletion {
  percentage: number;
  sections: ProfileCompletionSection[];
  nextStep?: string;
  isComplete: boolean;
}

/**
 * Get profile completion status
 */
export async function getProfileCompletion(): Promise<{
  success: boolean;
  completion?: ProfileCompletion;
  error?: string;
}> {
  try {
    const response = await apiRequest<{ success: boolean; completion: ProfileCompletion }>('/api/v1/user/profile/completion', { method: 'GET' });
    return response;
  } catch (error) {
    console.error('[UserAPI] Get profile completion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get profile completion',
    };
  }
}

/**
 * Force recalculate profile completion
 */
export async function recalculateProfileCompletion(): Promise<{
  success: boolean;
  completion?: ProfileCompletion;
  message?: string;
  error?: string;
}> {
  try {
    const response = await apiRequest<{
      success: boolean;
      completion: ProfileCompletion;
      message: string;
    }>('/api/v1/user/profile/completion/recalculate', { method: 'POST' });
    return response;
  } catch (error) {
    console.error('[UserAPI] Recalculate profile completion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to recalculate profile completion',
    };
  }
}

// Profile Completion Hooks
export function useProfileCompletion() {
  return useQuery({
    queryKey: ['profile-completion'],
    queryFn: getProfileCompletion,
    staleTime: 60_000,
  });
}

export function useRecalculateProfileCompletion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: recalculateProfileCompletion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
    },
  });
}

// ============================================================================
// Avatar API
// ============================================================================

export interface AvatarUpdateResponse {
  success: boolean;
  avatarUrl: string | null;
  user?: {
    id: string;
    email: string;
    name: string;
    handle: string;
    avatarUrl: string | null;
  };
  error?: string;
}

/**
 * Get current user's avatar URL
 */
export async function getAvatar(): Promise<{ avatarUrl: string | null }> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/user/me/avatar`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Update user's avatar URL
 */
export async function updateAvatar(avatarUrl: string): Promise<AvatarUpdateResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/user/me/avatar`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ avatarUrl }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Delete user's avatar
 */
export async function deleteAvatar(): Promise<{ success: boolean; message?: string }> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/user/me/avatar`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// React Query hooks for avatar
export function useAvatar() {
  return useQuery({
    queryKey: ['user-avatar'],
    queryFn: getAvatar,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-avatar'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-avatar'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
}

// ============================================================================
// User Identity API
// ============================================================================

export interface UserIdentity {
  id: string;
  email: string;
  display_name: string;
  firstName?: string | null;
  lastName?: string | null;
  handle: string;
  avatarUrl?: string | null;
  loyaltyInfo: {
    tier: string;
    points: number;
  };
  preferences: {
    travelDNA?: string | null;
    quizCompleted: boolean;
  };
  status: {
    emailVerified: boolean;
    onboardingCompleted: boolean;
  };
  memberSince?: string;
}

export interface UserIdentityResponse {
  success: boolean;
  identity?: UserIdentity;
  error?: string;
}

/**
 * Get current user's identity information
 */
export async function getUserIdentity(): Promise<UserIdentityResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/user/identity`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// React Query hook for user identity
export function useUserIdentity(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['user-identity'],
    queryFn: getUserIdentity,
    staleTime: 5 * 60_000, // 5 minutes
    enabled: options?.enabled !== false,
  });
}

// ============================================================================
// User Preferences API
// ============================================================================

export interface UserPreferences {
  preferredCurrency?: string;
  preferredLanguage?: string;
  newsletterOptIn?: boolean;
  dataCollectionOptIn?: boolean;
  budgetPreference?: string;
  pacePreference?: string;
  accommodationPreference?: string;
  transportPreference?: string[];
  dietaryRestrictions?: string[];
  accessibilityNeeds?: string[];
  [key: string]: unknown;
}

export interface PreferencesResponse {
  message: string;
  preferences: UserPreferences;
}

/**
 * Get user preferences
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/user/preferences`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.preferences || data;
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  preferences: Partial<UserPreferences>
): Promise<PreferencesResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/user/preferences`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(preferences),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// React Query hooks for preferences
export function useUserPreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['user-preferences'],
    queryFn: getUserPreferences,
    staleTime: 5 * 60_000,
    enabled: options?.enabled !== false,
  });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateUserPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['user-identity'] });
    },
  });
}

// ============================================================================
// GDPR API
// ============================================================================

export interface GDPRExportResponse {
  status: 'success' | 'error';
  message: string;
  data?: unknown;
}

export interface GDPRDeleteResponse {
  status: 'success' | 'error';
  message: string;
}

/**
 * Export user data (GDPR compliance)
 */
export async function exportUserData(): Promise<GDPRExportResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/gdpr/export`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Delete user account (GDPR compliance)
 */
export async function deleteUserAccount(): Promise<GDPRDeleteResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/gdpr/delete-account`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// React Query hooks for GDPR
export function useExportUserData() {
  return useMutation({
    mutationFn: exportUserData,
  });
}

export function useDeleteUserAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteUserAccount,
    onSuccess: () => {
      // Clear all cached data on account deletion
      queryClient.clear();
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const userAPI = {
  // Trip stats
  getTripStats,
  getTripSummary,
  
  // Profile trips
  getProfileTrips,
  getProfileTripStatistics,
  getNextTrip,
  getRecentTrips,
  getTripMilestones,
  
  // Onboarding
  getOnboardingStatus,
  completeProfileGuide,
  trackMilestone,
  
  // Profile completion
  getProfileCompletion,
  recalculateProfileCompletion,
  
  // Avatar
  getAvatar,
  updateAvatar,
  deleteAvatar,
  
  // Identity
  getUserIdentity,
  
  // Preferences
  getUserPreferences,
  updateUserPreferences,
  
  // GDPR
  exportUserData,
  deleteUserAccount,
};

export default userAPI;
