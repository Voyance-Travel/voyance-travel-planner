/**
 * User Stats API Service
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const API_BASE_URL = 'https://voyance-backend.railway.app';

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  if (!token) throw new Error('Authentication required');
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result._error || result.error || `Request failed: ${response.status}`);
  return result;
}
  id: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

export interface TripStats {
  planned: {
    count: number;
    trips: TripSummary[];
  };
  completed: {
    count: number;
    trips: TripSummary[];
  };
  drafts: {
    count: number;
    trips: TripSummary[];
  };
  total: number;
}

export interface CountryVisit {
  tripId: string;
  startDate: string | null;
  endDate: string | null;
  days: number;
  city: string;
}

export interface CountryStats {
  country: string;
  countryCode: string;
  visits: CountryVisit[];
  totalDays: number;
  cities: string[];
}

export interface CountriesResponse {
  countries: CountryStats[];
  totalCountries: number;
}

export interface NextTrip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  daysUntil: number;
}

export interface NextTripResponse {
  nextTrip: NextTrip | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  handle?: string;
  display_name?: string;
  provider?: string;
  created_at: string;
  last_login?: string;
}

export interface UserPreferences {
  travelStyle?: string;
  budget?: string;
  pace?: string;
  interests?: string[];
  dietaryRestrictions?: string[];
  // Add other preference fields as needed
}

export interface UserProfileResponse {
  user: UserProfile;
  preferences: UserPreferences | null;
  tripStats: {
    total: number;
    completed: number;
    upcoming: number;
    draft: number;
  };
}

export interface UpdateProfileInput {
  name?: string;
  firstName?: string;
  lastName?: string;
  handle?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

const API_BASE = '/api/v1/user';

export async function getTripStats(): Promise<TripStats> { return apiRequest<TripStats>(`${API_BASE}/stats/trips`); }
export async function getCountriesVisited(): Promise<CountriesResponse> { return apiRequest<CountriesResponse>(`${API_BASE}/stats/countries`); }
export async function getNextTrip(): Promise<NextTripResponse> { return apiRequest<NextTripResponse>(`${API_BASE}/stats/next-trip`); }
export async function getUserProfile(): Promise<UserProfileResponse> { return apiRequest<UserProfileResponse>(`${API_BASE}/profile`); }
export async function updateUserProfile(input: UpdateProfileInput): Promise<{ success: boolean; user: UserProfile }> {
  return apiRequest(`${API_BASE}/profile`, { method: 'PATCH', body: JSON.stringify(input) });
}
// React Query Hooks
export const userStatsKeys = {
  all: ['userStats'] as const, trips: () => [...userStatsKeys.all, 'trips'] as const,
  countries: () => [...userStatsKeys.all, 'countries'] as const, nextTrip: () => [...userStatsKeys.all, 'nextTrip'] as const,
  profile: () => [...userStatsKeys.all, 'profile'] as const,
};

export function useTripStats() { return useQuery({ queryKey: userStatsKeys.trips(), queryFn: getTripStats, staleTime: 5 * 60 * 1000 }); }
export function useCountriesVisited() { return useQuery({ queryKey: userStatsKeys.countries(), queryFn: getCountriesVisited, staleTime: 30 * 60 * 1000 }); }
export function useNextTrip() { return useQuery({ queryKey: userStatsKeys.nextTrip(), queryFn: getNextTrip, staleTime: 5 * 60 * 1000 }); }
export function useUserProfile() { return useQuery({ queryKey: userStatsKeys.profile(), queryFn: getUserProfile, staleTime: 10 * 60 * 1000 }); }

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: userStatsKeys.profile() }); toast.success('Profile updated!'); },
    onError: (error: Error) => { toast.error(error.message || 'Failed to update profile'); },
  });
}

// Helper Functions
export function formatDaysUntil(days: number): string {
  if (days === 0) return 'Today!'; if (days === 1) return 'Tomorrow'; if (days < 7) return `${days} days`;
  return days < 30 ? `${Math.floor(days / 7)} weeks` : `${Math.floor(days / 30)} months`;
}
export function getUserDisplayName(profile: UserProfile): string {
  return profile.display_name || (profile.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : profile.name || profile.email.split('@')[0]);
}
  profile: () => [...userStatsKeys.all, 'profile'] as const,
};

/**
 * Hook to fetch trip statistics
 */
export function useTripStats() {
  return useQuery({
    queryKey: userStatsKeys.trips(),
    queryFn: getTripStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch countries visited
 */
export function useCountriesVisited() {
  return useQuery({
    queryKey: userStatsKeys.countries(),
    queryFn: getCountriesVisited,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to fetch next trip
 */
export function useNextTrip() {
  return useQuery({
    queryKey: userStatsKeys.nextTrip(),
    queryFn: getNextTrip,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch user profile
 */
export function useUserProfile() {
  return useQuery({
    queryKey: userStatsKeys.profile(),
    queryFn: getUserProfile,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to update user profile
 */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userStatsKeys.profile() });
      toast.success('Profile updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format days until trip
 */
export function formatDaysUntil(days: number): string {
  if (days === 0) return 'Today!';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)} weeks`;
  return `${Math.floor(days / 30)} months`;
}

/**
 * Get trip status color
 */
export function getTripStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'text-muted-foreground',
    planned: 'text-blue-600',
    upcoming: 'text-green-600',
    completed: 'text-purple-600',
    cancelled: 'text-red-600',
  };
  return colors[status] || 'text-muted-foreground';
}

/**
 * Calculate total days traveled
 */
export function calculateTotalDaysTraveled(countries: CountryStats[]): number {
  return countries.reduce((total, country) => total + country.totalDays, 0);
}

/**
 * Get user's travel level based on stats
 */
export function getTravelLevel(totalTrips: number, countriesVisited: number): {
  level: string;
  nextLevel: string;
  progress: number;
} {
  if (totalTrips >= 50 || countriesVisited >= 25) {
    return { level: 'Globetrotter', nextLevel: 'Max Level', progress: 100 };
  }
  if (totalTrips >= 25 || countriesVisited >= 15) {
    return { 
      level: 'Explorer', 
      nextLevel: 'Globetrotter', 
      progress: Math.min(100, ((totalTrips + countriesVisited) / 75) * 100)
    };
  }
  if (totalTrips >= 10 || countriesVisited >= 5) {
    return { 
      level: 'Traveler', 
      nextLevel: 'Explorer', 
      progress: Math.min(100, ((totalTrips + countriesVisited) / 40) * 100)
    };
  }
  if (totalTrips >= 3) {
    return { 
      level: 'Adventurer', 
      nextLevel: 'Traveler', 
      progress: Math.min(100, ((totalTrips + countriesVisited) / 15) * 100)
    };
  }
  return { 
    level: 'Newcomer', 
    nextLevel: 'Adventurer', 
    progress: Math.min(100, (totalTrips / 3) * 100)
  };
}

/**
 * Get continent from country
 */
export function getContinentFromCountry(countryCode: string): string {
  const continentMap: Record<string, string> = {
    // Europe
    'FR': 'Europe', 'DE': 'Europe', 'IT': 'Europe', 'ES': 'Europe', 'GB': 'Europe',
    'PT': 'Europe', 'NL': 'Europe', 'BE': 'Europe', 'AT': 'Europe', 'CH': 'Europe',
    'GR': 'Europe', 'CZ': 'Europe', 'PL': 'Europe', 'HU': 'Europe', 'SE': 'Europe',
    'NO': 'Europe', 'DK': 'Europe', 'FI': 'Europe', 'IE': 'Europe', 'HR': 'Europe',
    // Asia
    'JP': 'Asia', 'CN': 'Asia', 'TH': 'Asia', 'VN': 'Asia', 'KR': 'Asia',
    'IN': 'Asia', 'ID': 'Asia', 'MY': 'Asia', 'SG': 'Asia', 'PH': 'Asia',
    'TW': 'Asia', 'HK': 'Asia', 'AE': 'Asia', 'IL': 'Asia', 'TR': 'Asia',
    // Americas
    'US': 'North America', 'CA': 'North America', 'MX': 'North America',
    'BR': 'South America', 'AR': 'South America', 'CL': 'South America',
    'PE': 'South America', 'CO': 'South America', 'CR': 'Central America',
    // Oceania
    'AU': 'Oceania', 'NZ': 'Oceania', 'FJ': 'Oceania',
    // Africa
    'ZA': 'Africa', 'EG': 'Africa', 'MA': 'Africa', 'KE': 'Africa', 'TZ': 'Africa',
  };
  return continentMap[countryCode] || 'Other';
}

/**
 * Group countries by continent
 */
export function groupCountriesByContinent(countries: CountryStats[]): Record<string, CountryStats[]> {
  const grouped: Record<string, CountryStats[]> = {};
  
  for (const country of countries) {
    const continent = getContinentFromCountry(country.countryCode);
    if (!grouped[continent]) {
      grouped[continent] = [];
    }
    grouped[continent].push(country);
  }
  
  return grouped;
}

/**
 * Get user display name
 */
export function getUserDisplayName(profile: UserProfile): string {
  if (profile.display_name) return profile.display_name;
  if (profile.firstName && profile.lastName) {
    return `${profile.firstName} ${profile.lastName}`;
  }
  if (profile.firstName) return profile.firstName;
  if (profile.name) return profile.name;
  if (profile.handle) return `@${profile.handle}`;
  return profile.email.split('@')[0];
}

/**
 * Validate handle format
 */
export function isValidHandle(handle: string): boolean {
  const handleRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return handleRegex.test(handle);
}
