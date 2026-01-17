/**
 * Venues API Service
 * 
 * Handles venue search with location filtering and TravelDNA scoring.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'all';

export interface VenueLocation {
  coordinates: {
    lat: number;
    lng: number;
  };
  address: string;
}

export interface TravelDnaProfile {
  cuisinePreferences?: string[];
  adventureLevel?: number;
  luxuryLevel?: number;
}

export interface Venue {
  id: string;
  title: string;
  description: string;
  category: string;
  location: VenueLocation;
  cost: number;
  tags: string[];
  travelDnaScore?: number;
  verified: boolean;
  timeSlots?: TimeSlot[];
}

export interface VenueSearchParams {
  destinationId: string;
  category?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  radiusKm?: number;
  limit?: number;
  travelDnaProfile?: TravelDnaProfile;
}

export interface PopularVenuesParams {
  destinationId: string;
  category?: string;
  timeSlot?: TimeSlot;
  limit?: number;
}

export interface VenueSearchResponse {
  status: 'success';
  venues: Venue[];
  fromCache: boolean;
  totalCount: number;
}

export interface PopularVenuesResponse {
  status: 'success';
  venues: Venue[];
  fromCache: boolean;
  totalCount: number;
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
 * Search venues with location and preference filtering
 */
export async function searchVenues(params: VenueSearchParams): Promise<VenueSearchResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/venues/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(error.error || 'Failed to search venues');
  }

  return response.json();
}

/**
 * Get popular venues for a destination
 */
export async function getPopularVenues(params: PopularVenuesParams): Promise<PopularVenuesResponse> {
  const headers = await getAuthHeader();
  const queryParams = new URLSearchParams();

  queryParams.set('destinationId', params.destinationId);
  if (params.category) queryParams.set('category', params.category);
  if (params.timeSlot) queryParams.set('timeSlot', params.timeSlot);
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const url = `${API_BASE_URL}/api/v1/venues/popular?${queryParams}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch popular venues');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useVenueSearch(params: VenueSearchParams | null) {
  return useQuery({
    queryKey: ['venues-search', params],
    queryFn: () => searchVenues(params!),
    enabled: !!params?.destinationId,
    staleTime: 900000, // 15 minutes (cached on backend)
  });
}

export function usePopularVenues(params: PopularVenuesParams | null) {
  return useQuery({
    queryKey: ['venues-popular', params],
    queryFn: () => getPopularVenues(params!),
    enabled: !!params?.destinationId,
    staleTime: 3600000, // 1 hour (cached on backend)
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTimeSlotLabel(slot: TimeSlot): string {
  const labels: Record<TimeSlot, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    all: 'All Day',
  };
  return labels[slot];
}

export function getTimeSlotIcon(slot: TimeSlot): string {
  const icons: Record<TimeSlot, string> = {
    morning: '🌅',
    afternoon: '☀️',
    evening: '🌙',
    all: '🕐',
  };
  return icons[slot];
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    restaurant: '🍽️',
    cafe: '☕',
    bar: '🍸',
    beach: '🏖️',
    cultural: '🏛️',
    shopping: '🛍️',
    tour: '🚶',
    entertainment: '🎭',
    nightlife: '🎉',
    spa: '💆',
    adventure: '🏄',
    nature: '🌿',
  };
  return icons[category.toLowerCase()] || '📍';
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}
