/**
 * Voyance Preferences V1 API Service
 * 
 * Integrates with Railway backend preferences v1 endpoints:
 * - GET /api/v1/user/preferences - Full hydrated preferences
 * - GET /api/v1/user/preferences/:section - Individual section
 * - PUT/PATCH /api/v1/user/preferences - Partial updates
 * - POST /api/v1/user/preferences/apply - Apply preferences to trip options
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// ============================================================================
// Types
// ============================================================================

export type BudgetTier = 'budget' | 'moderate' | 'luxury' | 'premium';
export type TravelPace = 'relaxed' | 'moderate' | 'fast';
export type PlanningPreference = 'structured' | 'flexible' | 'spontaneous';
export type AccommodationStyle = 'hostel' | 'budget_hotel' | 'standard_hotel' | 'boutique' | 'luxury';
export type SeatPreference = 'window' | 'aisle' | 'middle' | 'no_preference';
export type MobilityLevel = 'high' | 'moderate' | 'low' | 'wheelchair';
export type PreferenceSource = 'quiz' | 'user' | 'default';

export interface PreferencesSource {
  core: PreferenceSource;
  flight: PreferenceSource;
  food: PreferenceSource;
  mobility: PreferenceSource;
}

export interface FullPreferences {
  budgetTier: BudgetTier;
  travelPace: TravelPace;
  planningPreference: PlanningPreference;
  accommodationStyle: AccommodationStyle;
  ecoFriendly: boolean;
  homeAirport: string | null;
  directFlightsOnly: boolean;
  seatPreference: SeatPreference;
  preferredAirlines: string[];
  dietaryRestrictions: string[];
  foodLikes: string[];
  foodDislikes: string[];
  mobilityLevel: MobilityLevel;
  accessibilityNeeds: string[];
  allergies: string[];
  source: PreferencesSource;
}

export interface PreferencesUpdate {
  budgetTier?: BudgetTier;
  travelPace?: TravelPace;
  planningPreference?: PlanningPreference;
  accommodationStyle?: AccommodationStyle;
  ecoFriendly?: boolean;
  homeAirport?: string;
  directFlightsOnly?: boolean;
  seatPreference?: SeatPreference;
  preferredAirlines?: string[];
  dietaryRestrictions?: string[];
  foodLikes?: string[];
  foodDislikes?: string[];
  mobilityLevel?: MobilityLevel;
  accessibilityNeeds?: string[];
  allergies?: string[];
}

export type PreferencesSection = 'core' | 'flight' | 'food' | 'mobility' | 'travel-dna' | 'ai';

export interface TripOption {
  id: string;
  name: string;
  destination: string;
  price: number;
  duration: number;
  activities: string[];
  accommodationType: 'basic' | 'standard' | 'premium' | 'luxury';
  pace: 'slow' | 'balanced' | 'fast';
  style: 'adventure' | 'cultural' | 'relaxation' | 'culinary' | 'mixed';
}

export interface TripContext {
  budget: number;
  travelDates?: {
    start: string;
    end: string;
  };
  groupSize: number;
  specialRequirements?: string[];
}

export interface ApplyPreferencesInput {
  tripOptions: TripOption[];
  tripContext?: TripContext;
}

export interface ScoredTripOption extends TripOption {
  score: number;
  matchReasons: string[];
  mismatchReasons: string[];
}

export interface ApplyPreferencesResponse {
  success: boolean;
  scoredOptions?: ScoredTripOption[];
  topPick?: ScoredTripOption;
  userPreferences?: Partial<FullPreferences>;
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
  
  return { 'Content-Type': 'application/json' };
}

async function preferencesApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/user/preferences${endpoint}`, {
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
// Preferences V1 API
// ============================================================================

/**
 * Get full hydrated preferences
 */
export async function getFullPreferences(): Promise<FullPreferences> {
  try {
    const response = await preferencesApiRequest<FullPreferences>('', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[PreferencesV1API] Get full error:', error);
    throw error;
  }
}

/**
 * Get a specific preferences section
 */
export async function getPreferencesSection(section: PreferencesSection): Promise<Partial<FullPreferences>> {
  try {
    const response = await preferencesApiRequest<Partial<FullPreferences>>(`/${section}`, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[PreferencesV1API] Get section error:', error);
    throw error;
  }
}

/**
 * Update preferences (partial update)
 */
export async function updatePreferences(updates: PreferencesUpdate): Promise<FullPreferences> {
  try {
    const response = await preferencesApiRequest<FullPreferences>('', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return response;
  } catch (error) {
    console.error('[PreferencesV1API] Update error:', error);
    throw error;
  }
}

/**
 * Apply preferences to score trip options
 */
export async function applyPreferences(input: ApplyPreferencesInput): Promise<ApplyPreferencesResponse> {
  try {
    const response = await preferencesApiRequest<ApplyPreferencesResponse>('/apply', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[PreferencesV1API] Apply error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply preferences',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useFullPreferences() {
  return useQuery({
    queryKey: ['preferences-v1-full'],
    queryFn: getFullPreferences,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function usePreferencesSection(section: PreferencesSection | null) {
  return useQuery({
    queryKey: ['preferences-v1-section', section],
    queryFn: () => section ? getPreferencesSection(section) : Promise.reject('No section'),
    enabled: !!section,
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences-v1-full'] });
      queryClient.invalidateQueries({ queryKey: ['preferences-v1-section'] });
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    },
  });
}

export function useApplyPreferences() {
  return useMutation({
    mutationFn: applyPreferences,
  });
}

// ============================================================================
// Export
// ============================================================================

const preferencesV1API = {
  getFullPreferences,
  getPreferencesSection,
  updatePreferences,
  applyPreferences,
};

export default preferencesV1API;
