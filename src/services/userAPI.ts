/**
 * Voyance User API
 * 
 * User statistics and onboarding - all via Supabase.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

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

export interface TripCard {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  imageUrl?: string;
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
// API Functions
// ============================================================================

export async function getTripStats(): Promise<TripStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id);
  
  if (error) throw new Error(error.message);
  
  const allTrips = trips || [];
  const completedTrips = allTrips.filter(t => t.status === 'completed');
  const upcomingTrips = allTrips.filter(t => ['planning', 'booked', 'active'].includes(t.status));
  const draftTrips = allTrips.filter(t => t.status === 'draft');
  
  // Extract unique destinations
  const destinations = allTrips.map(t => t.destination);
  const uniqueCities = [...new Set(destinations)];
  const countries = allTrips.map(t => t.destination_country).filter(Boolean);
  const uniqueCountries = [...new Set(countries)];
  
  // Calculate days abroad
  let totalDays = 0;
  completedTrips.forEach(trip => {
    if (trip.start_date && trip.end_date) {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      totalDays += Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
  });
  
  const averageTripLength = completedTrips.length > 0 ? Math.round(totalDays / completedTrips.length) : 0;
  
  // Determine travel frequency
  let travelFrequency: TripStats['travelFrequency'] = 'new';
  if (completedTrips.length >= 10) travelFrequency = 'nomadic';
  else if (completedTrips.length >= 5) travelFrequency = 'frequent';
  else if (completedTrips.length >= 3) travelFrequency = 'regular';
  else if (completedTrips.length >= 1) travelFrequency = 'occasional';
  
  // Determine profile status
  let profileStatus: TripStats['profileStatus'] = 'planning';
  if (uniqueCountries.length >= 10) profileStatus = 'explorer';
  else if (uniqueCountries.length >= 5) profileStatus = 'traveler';
  else if (completedTrips.length >= 1) profileStatus = 'adventurer';
  
  return {
    totalTrips: allTrips.length,
    completedTrips: completedTrips.length,
    upcomingTrips: upcomingTrips.length,
    draftTrips: draftTrips.length,
    totalCountries: uniqueCountries.length,
    totalCities: uniqueCities.length,
    countriesVisited: uniqueCountries as string[],
    citiesVisited: uniqueCities,
    totalDaysAbroad: totalDays,
    averageTripLength,
    travelFrequency,
    profileStatus,
    isEmpty: allTrips.length === 0,
    isNewTraveler: completedTrips.length === 0,
    hasUpcomingAdventures: upcomingTrips.length > 0,
    summaryText: allTrips.length === 0 
      ? "Start planning your first adventure!" 
      : `${completedTrips.length} trips completed, ${upcomingTrips.length} upcoming`,
  };
}

export async function getTripStatsSummary(): Promise<TripStatsSummary> {
  const stats = await getTripStats();
  return {
    totalTrips: stats.totalTrips,
    completedTrips: stats.completedTrips,
    upcomingTrips: stats.upcomingTrips,
    hasTrips: stats.totalTrips > 0,
    displayText: stats.summaryText,
  };
}

export async function getNextTrip(): Promise<TripCard | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const today = new Date().toISOString().split('T')[0];
  
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_date', today)
    .in('status', ['planning', 'booked'])
    .order('start_date', { ascending: true })
    .limit(1)
    .single();
  
  if (!trip) return null;
  
  return {
    id: trip.id,
    destination: trip.destination,
    startDate: trip.start_date,
    endDate: trip.end_date,
    status: trip.status,
  };
}

export async function getRecentTrips(limit = 3): Promise<TripCard[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  
  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return (trips || []).map(trip => ({
    id: trip.id,
    destination: trip.destination,
    startDate: trip.start_date,
    endDate: trip.end_date,
    status: trip.status,
  }));
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      isNewUser: true,
      shouldShowProfileGuide: true,
      quizCompleted: false,
      onboardingCompleted: false,
      hasCreatedTrips: false,
      accountAge: 0,
      milestones: { quiz: false, profile: false, firstTrip: false, profileGuide: false },
    };
  }
  
  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('quiz_completed, created_at')
    .eq('id', user.id)
    .single();
  
  // Get trip count
  const { count: tripCount } = await supabase
    .from('trips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);
  
  const accountAge = profile?.created_at 
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  const quizCompleted = profile?.quiz_completed ?? false;
  const hasTrips = (tripCount || 0) > 0;
  const isNewUser = accountAge < 7 && !quizCompleted && !hasTrips;
  
  return {
    isNewUser,
    shouldShowProfileGuide: isNewUser && !quizCompleted,
    quizCompleted,
    onboardingCompleted: quizCompleted && hasTrips,
    hasCreatedTrips: hasTrips,
    accountAge,
    milestones: {
      quiz: quizCompleted,
      profile: true, // Profile is always created
      firstTrip: hasTrips,
      profileGuide: !isNewUser,
    },
  };
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useTripStats() {
  return useQuery({
    queryKey: ['user', 'tripStats'],
    queryFn: getTripStats,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTripStatsSummary() {
  return useQuery({
    queryKey: ['user', 'tripStatsSummary'],
    queryFn: getTripStatsSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNextTrip() {
  return useQuery({
    queryKey: ['user', 'nextTrip'],
    queryFn: getNextTrip,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentTrips(limit = 3) {
  return useQuery({
    queryKey: ['user', 'recentTrips', limit],
    queryFn: () => getRecentTrips(limit),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ['user', 'onboardingStatus'],
    queryFn: getOnboardingStatus,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Default Export
// ============================================================================

const userAPI = {
  getTripStats,
  getTripStatsSummary,
  getNextTrip,
  getRecentTrips,
  getOnboardingStatus,
};

export default userAPI;
