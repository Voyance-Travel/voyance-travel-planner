/**
 * User Stats API Service
 * 
 * Uses Supabase directly for all user statistics.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

// API Functions using Supabase directly
export async function getTripStats(): Promise<TripStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, destination, start_date, end_date, status')
    .eq('user_id', user.id);
  
  if (error) throw new Error(error.message);
  
  const now = new Date();
  const planned: TripSummary[] = [];
  const completed: TripSummary[] = [];
  const drafts: TripSummary[] = [];
  
  (trips || []).forEach(trip => {
    const summary: TripSummary = {
      id: trip.id,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      status: trip.status,
    };
    
    if (trip.status === 'draft') {
      drafts.push(summary);
    } else if (trip.status === 'completed') {
      completed.push(summary);
    } else if (trip.start_date && new Date(trip.start_date) > now) {
      planned.push(summary);
    } else if (trip.end_date && new Date(trip.end_date) < now) {
      completed.push(summary);
    } else {
      planned.push(summary);
    }
  });
  
  return {
    planned: { count: planned.length, trips: planned },
    completed: { count: completed.length, trips: completed },
    drafts: { count: drafts.length, trips: drafts },
    total: trips?.length || 0,
  };
}

export async function getCountriesVisited(): Promise<CountriesResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, destination, destination_country, start_date, end_date, status')
    .eq('user_id', user.id)
    .in('status', ['completed', 'booked', 'active']);
  
  if (error) throw new Error(error.message);
  
  const countryMap = new Map<string, CountryStats>();
  
  (trips || []).forEach(trip => {
    const country = trip.destination_country || 'Unknown';
    const existing = countryMap.get(country) || {
      country,
      countryCode: country.substring(0, 2).toUpperCase(),
      visits: [],
      totalDays: 0,
      cities: [],
    };
    
    const startDate = trip.start_date ? new Date(trip.start_date) : null;
    const endDate = trip.end_date ? new Date(trip.end_date) : null;
    const days = startDate && endDate 
      ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    existing.visits.push({
      tripId: trip.id,
      startDate: trip.start_date,
      endDate: trip.end_date,
      days,
      city: trip.destination,
    });
    
    existing.totalDays += days;
    if (!existing.cities.includes(trip.destination)) {
      existing.cities.push(trip.destination);
    }
    
    countryMap.set(country, existing);
  });
  
  const countries = Array.from(countryMap.values());
  
  return {
    countries,
    totalCountries: countries.length,
  };
}

export async function getNextTrip(): Promise<NextTripResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  
  const now = new Date().toISOString();
  
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, destination, start_date, end_date')
    .eq('user_id', user.id)
    .gte('start_date', now)
    .order('start_date', { ascending: true })
    .limit(1);
  
  if (error) throw new Error(error.message);
  
  if (!trips || trips.length === 0) {
    return { nextTrip: null };
  }
  
  const trip = trips[0];
  const startDate = new Date(trip.start_date);
  const daysUntil = Math.ceil((startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  return {
    nextTrip: {
      id: trip.id,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      daysUntil,
    },
  };
}

export async function getUserProfile(): Promise<UserProfileResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  
  const [profileResult, preferencesResult, tripsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
    supabase.from('trips').select('id, status, start_date, end_date').eq('user_id', user.id),
  ]);
  
  const profile = profileResult.data;
  const preferences = preferencesResult.data;
  const trips = tripsResult.data || [];
  
  const now = new Date();
  let completed = 0;
  let upcoming = 0;
  let draft = 0;
  
  trips.forEach(trip => {
    if (trip.status === 'draft') draft++;
    else if (trip.status === 'completed') completed++;
    else if (trip.start_date && new Date(trip.start_date) > now) upcoming++;
    else completed++;
  });
  
  return {
    user: {
      id: user.id,
      email: user.email || '',
      name: profile?.display_name,
      display_name: profile?.display_name,
      handle: profile?.handle,
      provider: user.app_metadata?.provider,
      created_at: user.created_at,
    },
    preferences: preferences as Record<string, unknown> | null,
    tripStats: { total: trips.length, completed, upcoming, draft },
  };
}

export async function updateUserProfile(input: UpdateProfileInput): Promise<{ success: boolean; user: UserProfile }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  
  const updates: Record<string, unknown> = {};
  if (input.name) updates.display_name = input.name;
  if (input.handle) updates.handle = input.handle;
  
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);
  
  if (error) throw new Error(error.message);
  
  return {
    success: true,
    user: {
      id: user.id,
      email: user.email || '',
      name: input.name,
      handle: input.handle,
      created_at: user.created_at,
    },
  };
}

// React Query Hooks
export const userStatsKeys = {
  all: ['userStats'] as const,
  trips: () => [...userStatsKeys.all, 'trips'] as const,
  countries: () => [...userStatsKeys.all, 'countries'] as const,
  nextTrip: () => [...userStatsKeys.all, 'nextTrip'] as const,
  profile: () => [...userStatsKeys.all, 'profile'] as const,
};

export function useTripStats() { 
  return useQuery({ 
    queryKey: userStatsKeys.trips(), 
    queryFn: getTripStats, 
    staleTime: 5 * 60 * 1000 
  }); 
}

export function useCountriesVisited() { 
  return useQuery({ 
    queryKey: userStatsKeys.countries(), 
    queryFn: getCountriesVisited, 
    staleTime: 30 * 60 * 1000 
  }); 
}

export function useNextTrip() { 
  return useQuery({ 
    queryKey: userStatsKeys.nextTrip(), 
    queryFn: getNextTrip, 
    staleTime: 5 * 60 * 1000 
  }); 
}

export function useUserProfile() { 
  return useQuery({ 
    queryKey: userStatsKeys.profile(), 
    queryFn: getUserProfile, 
    staleTime: 10 * 60 * 1000 
  }); 
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: userStatsKeys.profile() }); 
      toast.success('Profile updated!'); 
    },
    onError: (error: Error) => { 
      toast.error(error.message || 'Failed to update profile'); 
    },
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
