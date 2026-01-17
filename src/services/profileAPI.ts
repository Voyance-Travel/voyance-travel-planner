/**
 * Voyance Profile API Service
 * 
 * Integrates with Railway backend profile endpoints:
 * - GET /api/user/profile - Full user profile with preferences
 * - PUT /api/user/profile - Update user profile
 * - PATCH /api/user/profile/:field - Update single profile field
 * - GET /api/profile-stable - Stable profile (anti-flicker)
 * - GET /api/user/profile-lite - Lightweight profile
 * - GET /api/user/travel-dna-details - Detailed Travel DNA
 * - GET /v1/profile - Profile data for trip defaults
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface TravelDNAArchetype {
  primary: string;
  secondary?: string;
  confidence?: number;
  rarity?: string;
}

export interface TravelDNAPreferences {
  pace?: string;
  budget?: string;
  accommodation?: string;
  activityLevel?: string;
  planning?: string;
}

export interface TravelDNA {
  type: string;
  archetype?: TravelDNAArchetype;
  traits?: string[];
  preferences?: TravelDNAPreferences;
  emotionalDrivers?: string[];
  travelPersona?: {
    travelerType?: string;
    identityClass?: string;
    planningPreference?: string;
  };
  fullProfile?: Record<string, unknown>;
  calculatedAt?: string;
}

export interface UserPreferences {
  id?: string;
  userId?: string;
  budget?: string;
  travelStyle?: string;
  pace?: string;
  hotelStyle?: string;
  vibe?: string;
  activities?: Record<string, number>;
  climate?: string[];
  preferredRegions?: string[];
  dietaryRestrictions?: string[];
  tripDuration?: string;
  ecoFriendly?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
  display_name?: string;
  firstName?: string;
  lastName?: string;
  handle?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
  preferences?: UserPreferences | null;
  travelDNA?: TravelDNA | null;
  quizCompleted?: boolean;
}

export interface ProfileResponse {
  success: boolean;
  authenticated: boolean;
  profile: UserProfile | null;
  error?: {
    code: string;
    message: string;
  };
  _warning?: string;
  session?: {
    userId: string;
    email: string;
    provider?: string;
    timestamp: string;
  };
}

export interface ProfileLite {
  id: string;
  email: string;
  name?: string;
  display_name?: string;
  handle?: string;
  avatarUrl?: string;
  hasCompletedQuiz: boolean;
  quizCompletedAt?: string;
  travelDNA?: {
    type: string;
    secondary?: string;
    confidence?: number;
    rarity?: string;
    preferences?: TravelDNAPreferences;
  } | null;
  memberSince?: string;
}

export interface ProfileLiteResponse {
  success: boolean;
  profile?: ProfileLite;
  error?: string;
  code?: string;
}

export interface TravelDNADetails {
  archetype: {
    primary: string;
    secondary?: string;
    confidence?: number;
    rarity?: string;
  };
  personality: {
    emotionalDrivers?: string[];
    travelerType?: string;
    activityLevel?: string;
    interests?: Record<string, unknown>;
  };
  preferences: {
    pace?: string;
    budget?: string;
    planning?: string;
    accommodation?: string;
  };
  traits?: Record<string, number>;
  primaryGoal?: string;
  identityClass?: string;
  calculatedAt?: string;
}

export interface TravelDNADetailsResponse {
  success: boolean;
  travelDNA?: TravelDNADetails;
  error?: string;
  code?: string;
}

export interface ProfileUpdateInput {
  name?: string;
  handle?: string;
  profileImage?: string;
  bio?: string;
}

export interface ProfileUpdateResponse {
  success: boolean;
  profile?: UserProfile;
  message?: string;
  error?: string;
  code?: string;
}

export interface ProfileFieldUpdateInput {
  value: string | boolean | string[] | number;
}

export interface ProfileDataResponse {
  defaultOriginCity?: string;
  homeAirportIata?: string;
}

export interface SessionVerifyResponse {
  valid: boolean;
  userId?: string;
  email?: string;
  timestamp: string;
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

async function profileApiRequest<T>(
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
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Profile API
// ============================================================================

/**
 * Get full user profile with preferences and Travel DNA
 */
export async function getProfile(): Promise<ProfileResponse> {
  try {
    const response = await profileApiRequest<ProfileResponse>('/api/user/profile');
    return response;
  } catch (error) {
    console.error('[ProfileAPI] Get profile error:', error);
    return {
      success: false,
      authenticated: false,
      profile: null,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch profile',
      },
    };
  }
}

/**
 * Get stable profile (anti-flicker endpoint)
 */
export async function getStableProfile(): Promise<ProfileResponse> {
  try {
    const response = await profileApiRequest<ProfileResponse>('/api/profile-stable');
    return response;
  } catch (error) {
    console.error('[ProfileAPI] Get stable profile error:', error);
    return {
      success: false,
      authenticated: false,
      profile: null,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch stable profile',
      },
    };
  }
}

/**
 * Get lightweight profile (faster loading)
 */
export async function getProfileLite(): Promise<ProfileLiteResponse> {
  try {
    const response = await profileApiRequest<ProfileLiteResponse>('/api/user/profile-lite');
    return response;
  } catch (error) {
    console.error('[ProfileAPI] Get profile lite error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch profile',
      code: 'FETCH_ERROR',
    };
  }
}

/**
 * Get detailed Travel DNA information
 */
export async function getTravelDNADetails(): Promise<TravelDNADetailsResponse> {
  try {
    const response = await profileApiRequest<TravelDNADetailsResponse>('/api/user/travel-dna-details');
    return response;
  } catch (error) {
    console.error('[ProfileAPI] Get travel DNA details error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Travel DNA details',
      code: 'FETCH_ERROR',
    };
  }
}

/**
 * Get profile data for trip defaults (origin city, home airport)
 */
export async function getProfileData(): Promise<ProfileDataResponse> {
  try {
    const response = await profileApiRequest<ProfileDataResponse>('/v1/profile');
    return response;
  } catch (error) {
    console.error('[ProfileAPI] Get profile data error:', error);
    return {
      defaultOriginCity: '',
      homeAirportIata: undefined,
    };
  }
}

/**
 * Update user profile
 */
export async function updateProfile(data: ProfileUpdateInput): Promise<ProfileUpdateResponse> {
  try {
    const response = await profileApiRequest<ProfileUpdateResponse>('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response;
  } catch (error) {
    console.error('[ProfileAPI] Update profile error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update profile',
      code: 'UPDATE_ERROR',
    };
  }
}

/**
 * Update a single profile field
 */
export async function updateProfileField(
  field: string,
  input: ProfileFieldUpdateInput
): Promise<ProfileUpdateResponse> {
  try {
    const response = await profileApiRequest<ProfileUpdateResponse>(`/api/user/profile/${field}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[ProfileAPI] Update profile field error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update profile field',
      code: 'UPDATE_ERROR',
    };
  }
}

/**
 * Verify session is valid
 */
export async function verifySession(): Promise<SessionVerifyResponse> {
  try {
    const response = await profileApiRequest<SessionVerifyResponse>('/api/verify-session');
    return response;
  } catch (error) {
    console.error('[ProfileAPI] Verify session error:', error);
    return {
      valid: false,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

const profileKeys = {
  all: ['profile'] as const,
  profile: () => [...profileKeys.all, 'full'] as const,
  stable: () => [...profileKeys.all, 'stable'] as const,
  lite: () => [...profileKeys.all, 'lite'] as const,
  travelDNA: () => [...profileKeys.all, 'travel-dna'] as const,
  data: () => [...profileKeys.all, 'data'] as const,
  session: () => [...profileKeys.all, 'session'] as const,
};

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.profile(),
    queryFn: getProfile,
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 30 * 60_000, // 30 minutes
  });
}

export function useStableProfile() {
  return useQuery({
    queryKey: profileKeys.stable(),
    queryFn: getStableProfile,
    staleTime: 30_000, // 30 seconds - more aggressive caching to prevent flicker
    gcTime: 5 * 60_000,
    retry: 1,
    retryDelay: 1000,
  });
}

export function useProfileLite() {
  return useQuery({
    queryKey: profileKeys.lite(),
    queryFn: getProfileLite,
    staleTime: 2 * 60_000, // 2 minutes
  });
}

export function useTravelDNADetails() {
  return useQuery({
    queryKey: profileKeys.travelDNA(),
    queryFn: getTravelDNADetails,
    staleTime: 5 * 60_000,
  });
}

export function useProfileData() {
  return useQuery({
    queryKey: profileKeys.data(),
    queryFn: getProfileData,
    staleTime: 10 * 60_000, // 10 minutes - this data changes infrequently
  });
}

export function useVerifySession() {
  return useQuery({
    queryKey: profileKeys.session(),
    queryFn: verifySession,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Check every minute
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

export function useUpdateProfileField() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ field, input }: { field: string; input: ProfileFieldUpdateInput }) =>
      updateProfileField(field, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

// Default export
export default {
  getProfile,
  getStableProfile,
  getProfileLite,
  getTravelDNADetails,
  getProfileData,
  updateProfile,
  updateProfileField,
  verifySession,
};
