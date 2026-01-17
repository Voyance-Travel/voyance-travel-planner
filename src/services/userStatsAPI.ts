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

// Types
export interface TripSummary {
  id: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

export interface TripStats {
  planned: { count: number; trips: TripSummary[]; };
  completed: { count: number; trips: TripSummary[]; };
  drafts: { count: number; trips: TripSummary[]; };
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

export interface UserProfileResponse {
  user: UserProfile;
  preferences: Record<string, unknown> | null;
  tripStats: { total: number; completed: number; upcoming: number; draft: number; };
}

export interface UpdateProfileInput {
  name?: string;
  firstName?: string;
  lastName?: string;
  handle?: string;
}

// API Functions
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
  all: ['userStats'] as const,
  trips: () => [...userStatsKeys.all, 'trips'] as const,
  countries: () => [...userStatsKeys.all, 'countries'] as const,
  nextTrip: () => [...userStatsKeys.all, 'nextTrip'] as const,
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
  if (days === 0) return 'Today!';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `${days} days`;
  return days < 30 ? `${Math.floor(days / 7)} weeks` : `${Math.floor(days / 30)} months`;
}

export function getUserDisplayName(profile: UserProfile): string {
  return profile.display_name || (profile.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : profile.name || profile.email.split('@')[0]);
}
