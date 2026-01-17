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
};

export default userAPI;
