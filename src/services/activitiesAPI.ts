/**
 * Activities API Service
 * 
 * Handles activity catalog search with TravelDNA scoring.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

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
  location: ActivityLocation;
  cost: number;
  duration: number; // in minutes
  tags: string[];
  travelDnaScore?: number;
  verified: boolean;
  seasonality: string[];
  weatherDependency: WeatherDependency;
}

export interface ActivitySearchParams {
  destinationId: string;
  category?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  limit?: number;
}

export interface ActivitySearchResponse {
  status: 'success';
  activities: Activity[];
  fromCache: boolean;
  totalCount: number;
}

export interface ActivityDetailsResponse {
  status: 'success';
  activity: Activity;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  const token = localStorage.getItem('voyance_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Search activities for a destination
 */
export async function searchActivities(params: ActivitySearchParams): Promise<ActivitySearchResponse> {
  const headers = await getAuthHeader();
  const queryParams = new URLSearchParams();

  queryParams.set('destinationId', params.destinationId);
  if (params.category) queryParams.set('category', params.category);
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.priceRange) {
    queryParams.set('priceRange', JSON.stringify(params.priceRange));
  }

  const url = `${API_BASE_URL}/api/v1/activities/search?${queryParams}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(error.error || 'Failed to search activities');
  }

  return response.json();
}

/**
 * Get activity details by ID
 */
export async function getActivityDetails(activityId: string): Promise<ActivityDetailsResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/activities/${activityId}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch activity details');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useActivitySearch(params: ActivitySearchParams | null) {
  return useQuery({
    queryKey: ['activities-search', params],
    queryFn: () => searchActivities(params!),
    enabled: !!params?.destinationId,
    staleTime: 1800000, // 30 minutes (cached on backend)
  });
}

export function useActivityDetails(activityId: string | null) {
  return useQuery({
    queryKey: ['activity-details', activityId],
    queryFn: () => getActivityDetails(activityId!),
    enabled: !!activityId,
    staleTime: 3600000, // 1 hour (cached on backend)
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
