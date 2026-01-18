/**
 * Activities API Service
 * 
 * Uses Cloud edge function with Viator API for bookable activities.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export type WeatherDependency = 'low' | 'medium' | 'high';

export interface ActivityLocation {
  coordinates: {
    lat: number;
    lng: number;
  };
  address: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  location?: ActivityLocation;
  price: number;
  currency: string;
  duration: number; // in minutes
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  bookingUrl: string | null;
  tags?: string[];
  travelDnaScore?: number;
  verified?: boolean;
  seasonality?: string[];
  weatherDependency?: WeatherDependency;
  source: 'viator' | 'database';
}

export interface ActivitySearchParams {
  destination?: string;
  destinationId?: string;
  category?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  limit?: number;
}

export interface ActivitySearchResponse {
  success: boolean;
  activities: Activity[];
  totalCount: number;
  source: 'viator' | 'database' | 'mixed';
  fromCache: boolean;
}

export interface ActivityDetailsResponse {
  status: 'success';
  activity: Activity;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Search activities for a destination using Cloud edge function
 */
export async function searchActivities(params: ActivitySearchParams): Promise<ActivitySearchResponse> {
  const queryParams = new URLSearchParams();

  if (params.destination) queryParams.set('destination', params.destination);
  if (params.destinationId) queryParams.set('destinationId', params.destinationId);
  if (params.category) queryParams.set('category', params.category);
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const { data, error } = await supabase.functions.invoke('activities', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: null,
  });

  // Edge functions with GET need query params in URL - use POST instead
  const { data: result, error: invokeError } = await supabase.functions.invoke(`activities?${queryParams.toString()}`);

  if (invokeError) {
    console.error('[Activities] Edge function error:', invokeError);
    throw new Error(invokeError.message || 'Failed to search activities');
  }

  return result as ActivitySearchResponse;
}

/**
 * Get activity details by ID (from database)
 */
export async function getActivityDetails(activityId: string): Promise<ActivityDetailsResponse> {
  const { data, error } = await supabase
    .from('activity_catalog')
    .select('*')
    .eq('id', activityId)
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to fetch activity details');
  }

  return {
    status: 'success',
    activity: {
      id: data.id,
      title: data.title,
      description: data.description || '',
      category: data.category || 'Activity',
      price: data.cost_usd || 0,
      currency: 'USD',
      duration: (data.estimated_duration_hours || 2) * 60,
      imageUrl: null,
      rating: null,
      reviewCount: null,
      bookingUrl: null,
      source: 'database',
    },
  };
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useActivitySearch(params: ActivitySearchParams | null) {
  return useQuery({
    queryKey: ['activities-search', params],
    queryFn: () => searchActivities(params!),
    enabled: !!(params?.destinationId || params?.destination),
    staleTime: 1800000, // 30 minutes
  });
}

export function useActivityDetails(activityId: string | null) {
  return useQuery({
    queryKey: ['activity-details', activityId],
    queryFn: () => getActivityDetails(activityId!),
    enabled: !!activityId,
    staleTime: 3600000, // 1 hour
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hr ${remainingMinutes} min`;
}

export function formatCost(cost: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cost);
}

export function getWeatherDependencyLabel(dependency: WeatherDependency): string {
  const labels: Record<WeatherDependency, string> = {
    low: 'All Weather',
    medium: 'Weather Dependent',
    high: 'Outdoor Only',
  };
  return labels[dependency];
}

export function getWeatherDependencyColor(dependency: WeatherDependency): string {
  const colors: Record<WeatherDependency, string> = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-red-600',
  };
  return colors[dependency];
}

export function getTravelDnaScoreLabel(score: number): string {
  if (score >= 8) return 'Perfect Match';
  if (score >= 6) return 'Great Match';
  if (score >= 4) return 'Good Match';
  return 'Explore Something New';
}
