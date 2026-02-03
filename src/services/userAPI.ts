/**
 * Voyance User API
 * 
 * User statistics and onboarding - all via Supabase.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// ============================================================================
// City → Country Mapping (for stats when destination_country is missing)
// ============================================================================

const CITY_TO_COUNTRY: Record<string, string> = {
  'london': 'United Kingdom',
  'paris': 'France',
  'rome': 'Italy',
  'barcelona': 'Spain',
  'madrid': 'Spain',
  'lisbon': 'Portugal',
  'porto': 'Portugal',
  'amsterdam': 'Netherlands',
  'berlin': 'Germany',
  'munich': 'Germany',
  'vienna': 'Austria',
  'prague': 'Czech Republic',
  'budapest': 'Hungary',
  'athens': 'Greece',
  'santorini': 'Greece',
  'dublin': 'Ireland',
  'edinburgh': 'United Kingdom',
  'copenhagen': 'Denmark',
  'stockholm': 'Sweden',
  'oslo': 'Norway',
  'reykjavik': 'Iceland',
  'tokyo': 'Japan',
  'kyoto': 'Japan',
  'osaka': 'Japan',
  'seoul': 'South Korea',
  'bangkok': 'Thailand',
  'singapore': 'Singapore',
  'bali': 'Indonesia',
  'hanoi': 'Vietnam',
  'ho chi minh': 'Vietnam',
  'new york': 'United States',
  'los angeles': 'United States',
  'san francisco': 'United States',
  'miami': 'United States',
  'chicago': 'United States',
  'new orleans': 'United States',
  'vancouver': 'Canada',
  'toronto': 'Canada',
  'montreal': 'Canada',
  'mexico city': 'Mexico',
  'cancun': 'Mexico',
  'buenos aires': 'Argentina',
  'rio de janeiro': 'Brazil',
  'sao paulo': 'Brazil',
  'cartagena': 'Colombia',
  'bogota': 'Colombia',
  'lima': 'Peru',
  'cusco': 'Peru',
  'cape town': 'South Africa',
  'johannesburg': 'South Africa',
  'marrakech': 'Morocco',
  'cairo': 'Egypt',
  'dubai': 'United Arab Emirates',
  'abu dhabi': 'United Arab Emirates',
  'doha': 'Qatar',
  'sydney': 'Australia',
  'melbourne': 'Australia',
  'auckland': 'New Zealand',
  'queenstown': 'New Zealand',
  'florence': 'Italy',
  'venice': 'Italy',
  'milan': 'Italy',
  'naples': 'Italy',
  'nice': 'France',
  'marseille': 'France',
  'lyon': 'France',
  'seville': 'Spain',
  'valencia': 'Spain',
  'malaga': 'Spain',
  'zurich': 'Switzerland',
  'geneva': 'Switzerland',
  'brussels': 'Belgium',
  'warsaw': 'Poland',
  'krakow': 'Poland',
  'tel aviv': 'Israel',
  'jerusalem': 'Israel',
  'istanbul': 'Turkey',
  'moscow': 'Russia',
  'st petersburg': 'Russia',
  'helsinki': 'Finland',
  'tallinn': 'Estonia',
  'riga': 'Latvia',
  'vilnius': 'Lithuania',
};

function inferCountryFromDestination(destination: string | null | undefined): string | null {
  if (!destination) return null;
  // Clean up destination (remove airport codes like "(LHR)")
  const clean = destination.replace(/\s*\([A-Z]{3}\)\s*$/i, '').trim().toLowerCase();
  
  // Direct match
  if (CITY_TO_COUNTRY[clean]) return CITY_TO_COUNTRY[clean];
  
  // Try first word (city name before comma)
  const cityOnly = clean.split(',')[0].trim();
  if (CITY_TO_COUNTRY[cityOnly]) return CITY_TO_COUNTRY[cityOnly];
  
  // Partial match (e.g., "New York City" → "new york")
  for (const [city, country] of Object.entries(CITY_TO_COUNTRY)) {
    if (clean.includes(city) || city.includes(clean)) {
      return country;
    }
  }
  
  return null;
}

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
  const now = new Date();
  
  // Filter trips by actual dates, not just status
  const completedTrips = allTrips.filter(t => {
    // Status-based: explicitly completed
    if (t.status === 'completed') return true;
    // Date-based: trip has ended (end_date is in the past)
    // Include drafts that have past end dates - these are real trips that happened
    if (t.end_date && new Date(t.end_date) < now) return true;
    return false;
  });
  
  const upcomingTrips = allTrips.filter(t => {
    // Explicitly completed trips are not upcoming
    if (t.status === 'completed') return false;
    // Trip has already ended - not upcoming
    if (t.end_date && new Date(t.end_date) < now) return false;
    // Trip hasn't ended yet (future or currently ongoing)
    if (t.end_date && new Date(t.end_date) >= now) return true;
    // No end date but has future start date
    if (t.start_date && new Date(t.start_date) >= now) return true;
    return false;
  });
  
  const draftTrips = allTrips.filter(t => t.status === 'draft');
  
  // Extract unique destinations from COMPLETED trips only
  const completedDestinations = completedTrips.map(t => t.destination);
  const uniqueCities = [...new Set(completedDestinations)];
  
  // Derive country from destination when destination_country is missing - COMPLETED trips only
  const countries = completedTrips.map(t => {
    if (t.destination_country) return t.destination_country;
    // Fallback: infer country from destination city name
    return inferCountryFromDestination(t.destination);
  }).filter(Boolean);
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
      profile: true,
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
