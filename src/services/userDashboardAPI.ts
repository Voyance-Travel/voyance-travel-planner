/**
 * Voyance User Dashboard API Service
 * 
 * User dashboard - now using Supabase directly.
 * Aggregates data from trips and profiles tables.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Types
// ============================================================================

export interface DashboardCounts {
  trips: number;
  countries: number;
  daysAbroad: number;
}

export interface DashboardTrip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  status?: string;
}

export interface DashboardData {
  counts: DashboardCounts;
  lastTrip: DashboardTrip | null;
  upcomingTrip: DashboardTrip | null;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

export interface MinimalDashboardUser {
  id: string;
  email: string;
  name: string | null;
}

export interface MinimalDashboardResponse {
  user: MinimalDashboardUser | null;
  hasTrips: boolean;
  _meta: {
    fetchedAt: string;
    ttl: number;
  };
}

export interface DashboardTestResponse {
  success: boolean;
  message: string;
  userId: string;
  timestamp: string;
}

// ============================================================================
// Dashboard API - Using Supabase
// ============================================================================

/**
 * Get full aggregated dashboard data
 */
export async function getDashboard(): Promise<DashboardResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      success: false,
      data: {
        counts: { trips: 0, countries: 0, daysAbroad: 0 },
        lastTrip: null,
        upcomingTrip: null,
      },
    };
  }

  // Get all trips
  const { data: trips } = await supabase
    .from('trips')
    .select('id, destination, destination_country, start_date, end_date, status')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false });

  const allTrips = trips || [];

  // Calculate counts
  const countries = new Set(allTrips.map(t => t.destination_country).filter(Boolean));
  let daysAbroad = 0;

  for (const trip of allTrips) {
    if (trip.start_date && trip.end_date) {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      daysAbroad += Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  // Find last completed trip
  const now = new Date();
  const pastTrips = allTrips.filter(t => new Date(t.end_date) < now);
  const lastTrip = pastTrips.length > 0 ? {
    id: pastTrips[0].id,
    destination: pastTrips[0].destination,
    startDate: pastTrips[0].start_date,
    endDate: pastTrips[0].end_date,
    status: pastTrips[0].status,
  } : null;

  // Find upcoming trip
  const futureTrips = allTrips
    .filter(t => new Date(t.start_date) >= now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const upcomingTrip = futureTrips.length > 0 ? {
    id: futureTrips[0].id,
    destination: futureTrips[0].destination,
    startDate: futureTrips[0].start_date,
    endDate: futureTrips[0].end_date,
    status: futureTrips[0].status,
  } : null;

  return {
    success: true,
    data: {
      counts: {
        trips: allTrips.length,
        countries: countries.size,
        daysAbroad,
      },
      lastTrip,
      upcomingTrip,
    },
  };
}

/**
 * Get minimal dashboard data for quick checks
 */
export async function getMinimalDashboard(): Promise<MinimalDashboardResponse> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      hasTrips: false,
      _meta: { fetchedAt: new Date().toISOString(), ttl: 600 },
    };
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  // Check if has trips
  const { count } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return {
    user: {
      id: user.id,
      email: user.email || '',
      name: profile?.display_name || null,
    },
    hasTrips: (count || 0) > 0,
    _meta: { fetchedAt: new Date().toISOString(), ttl: 600 },
  };
}

/**
 * Test dashboard endpoint health
 */
export async function testDashboard(): Promise<DashboardTestResponse> {
  const { data: { user } } = await supabase.auth.getUser();

  return {
    success: true,
    message: 'Dashboard is healthy',
    userId: user?.id || 'anonymous',
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// React Query Hooks
// ============================================================================

const dashboardKeys = {
  all: ['user-dashboard'] as const,
  full: () => [...dashboardKeys.all, 'full'] as const,
  minimal: () => [...dashboardKeys.all, 'minimal'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.full(),
    queryFn: getDashboard,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useMinimalDashboard() {
  return useQuery({
    queryKey: dashboardKeys.minimal(),
    queryFn: getMinimalDashboard,
    staleTime: 10 * 60_000, // 10 minutes
  });
}

// Default export
export default {
  getDashboard,
  getMinimalDashboard,
  testDashboard,
};
