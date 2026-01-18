/**
 * Voyance Dashboard API Service
 * 
 * Dashboard data - now using Supabase directly.
 * Aggregates data from trips table.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface SavedTrip {
  sessionId: string;
  tripDetails: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSession {
  userId: string;
  sessionId: string;
  tripDetails: Record<string, unknown>;
}

export interface DashboardResponse {
  trips: SavedTrip[];
  redisCache: ActiveSession[];
}

export type BudgetZone = 'budget' | 'moderate' | 'premium' | 'luxury';

export interface BudgetZoneThreshold {
  min: number;
  max: number;
}

export interface BudgetZoneResponse {
  zone: BudgetZone;
  color: string;
  description: string;
  threshold: BudgetZoneThreshold;
}

// ============================================================================
// Dashboard API - Using Supabase trips table
// ============================================================================

/**
 * Get user's dashboard data (saved trips)
 */
export async function getDashboard(): Promise<DashboardResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { trips: [], redisCache: [] };
  }

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[DashboardAPI] Get dashboard error:', error);
    throw error;
  }

  const savedTrips: SavedTrip[] = (trips || []).map(trip => {
    const metadata = trip.metadata as Record<string, unknown> | null;
    return {
      sessionId: (metadata?.sessionId as string) || trip.id,
      tripDetails: {
        id: trip.id,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        status: trip.status,
        travelers: trip.travelers,
        budgetTier: trip.budget_tier,
      },
      createdAt: trip.created_at,
      updatedAt: trip.updated_at,
    };
  });

  return {
    trips: savedTrips,
    redisCache: [], // No longer using Redis cache
  };
}

/**
 * Get user's budget zone based on their preferences or provided budget
 */
export async function getBudgetZone(budget?: number): Promise<BudgetZoneResponse> {
  // If budget provided, calculate directly
  if (budget !== undefined) {
    return calculateBudgetZone(budget);
  }

  // Otherwise, get from user preferences
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return getDefaultBudgetZone();
  }

  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('budget_tier, budget_range')
    .eq('user_id', user.id)
    .single();

  if (preferences?.budget_tier) {
    return getBudgetZoneFromTier(preferences.budget_tier);
  }

  if (preferences?.budget_range) {
    const range = preferences.budget_range as { max?: number };
    if (range.max) {
      return calculateBudgetZone(range.max);
    }
  }

  return getDefaultBudgetZone();
}

function calculateBudgetZone(budget: number): BudgetZoneResponse {
  if (budget < 1000) {
    return {
      zone: 'budget',
      color: 'green',
      description: 'You prefer affordable, value-focused travel experiences.',
      threshold: { min: 0, max: 1000 },
    };
  } else if (budget < 3000) {
    return {
      zone: 'moderate',
      color: 'blue',
      description: 'You balance comfort and value in your travel choices.',
      threshold: { min: 1000, max: 3000 },
    };
  } else if (budget < 7000) {
    return {
      zone: 'premium',
      color: 'purple',
      description: 'You enjoy elevated experiences and premium amenities.',
      threshold: { min: 3000, max: 7000 },
    };
  } else {
    return {
      zone: 'luxury',
      color: 'amber',
      description: 'You seek the finest travel experiences without limits.',
      threshold: { min: 7000, max: 50000 },
    };
  }
}

function getBudgetZoneFromTier(tier: string): BudgetZoneResponse {
  switch (tier.toLowerCase()) {
    case 'budget':
    case 'safe':
      return {
        zone: 'budget',
        color: 'green',
        description: 'You prefer affordable, value-focused travel experiences.',
        threshold: { min: 0, max: 1000 },
      };
    case 'moderate':
    case 'stretch':
      return {
        zone: 'moderate',
        color: 'blue',
        description: 'You balance comfort and value in your travel choices.',
        threshold: { min: 1000, max: 3000 },
      };
    case 'premium':
    case 'splurge':
      return {
        zone: 'premium',
        color: 'purple',
        description: 'You enjoy elevated experiences and premium amenities.',
        threshold: { min: 3000, max: 7000 },
      };
    case 'luxury':
      return {
        zone: 'luxury',
        color: 'amber',
        description: 'You seek the finest travel experiences without limits.',
        threshold: { min: 7000, max: 50000 },
      };
    default:
      return getDefaultBudgetZone();
  }
}

function getDefaultBudgetZone(): BudgetZoneResponse {
  return {
    zone: 'moderate',
    color: 'blue',
    description: 'You balance comfort and value in your travel choices.',
    threshold: { min: 1000, max: 3000 },
  };
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 60_000, // 1 minute
  });
}

export function useBudgetZone(budget?: number) {
  return useQuery({
    queryKey: ['budget-zone', budget],
    queryFn: () => getBudgetZone(budget),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getBudgetZoneColor(zone: BudgetZone): string {
  switch (zone) {
    case 'budget': return 'bg-green-500';
    case 'moderate': return 'bg-blue-500';
    case 'premium': return 'bg-purple-500';
    case 'luxury': return 'bg-amber-500';
    default: return 'bg-muted';
  }
}

export function getBudgetZoneLabel(zone: BudgetZone): string {
  switch (zone) {
    case 'budget': return 'Budget Traveler';
    case 'moderate': return 'Moderate Spender';
    case 'premium': return 'Premium Traveler';
    case 'luxury': return 'Luxury Explorer';
    default: return 'Unknown';
  }
}

// ============================================================================
// Export
// ============================================================================

const dashboardAPI = {
  getDashboard,
  getBudgetZone,
  getBudgetZoneColor,
  getBudgetZoneLabel,
};

export default dashboardAPI;
