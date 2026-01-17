/**
 * Destinations Extended API Service
 * 
 * Frontend-compatible destination routes with filtering and search.
 */

import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export type CostTier = 'LOW' | 'MID' | 'HIGH';
export type DestinationTier = 'TOP' | 'STANDARD' | 'EMERGING';

export interface Destination {
  id?: string;
  name: string;
  city: string;
  country: string;
  imageUrl: string;
  image_url?: string;
  region: string;
  description: string;
  tags: string[];
  featured?: boolean;
  costTier?: CostTier;
}

export interface DestinationDetail extends Destination {
  timezone?: string;
  currencyCode?: string;
  airportCode?: string;
  knownFor?: string[];
  pointsOfInterest?: string[];
  bestTimeToVisit?: string;
  temperatureRange?: string;
  seasonality?: string;
}

export interface DestinationFilters {
  season?: string;
  vibe?: string;
  tag?: string;
  region?: string;
  budget?: 'budget' | 'mid-range' | 'luxury';
  activity?: string;
  sort?: 'popularity' | 'alphabetical';
  page?: number;
  limit?: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get destinations with filtering
 */
export async function getDestinations(filters?: DestinationFilters): Promise<Destination[]> {
  const queryParams = new URLSearchParams();
  
  if (filters?.season) queryParams.set('season', filters.season);
  if (filters?.vibe) queryParams.set('vibe', filters.vibe);
  if (filters?.tag) queryParams.set('tag', filters.tag);
  if (filters?.region) queryParams.set('region', filters.region);
  if (filters?.budget) queryParams.set('budget', filters.budget);
  if (filters?.activity) queryParams.set('activity', filters.activity);
  if (filters?.sort) queryParams.set('sort', filters.sort);
  if (filters?.page) queryParams.set('page', filters.page.toString());
  if (filters?.limit) queryParams.set('limit', filters.limit.toString());

  const url = `${API_BASE_URL}/api/destinations${queryParams.toString() ? `?${queryParams}` : ''}`;
  
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch destinations');
  }

  return response.json();
}

/**
 * Get destinations by tag
 */
export async function getDestinationsByTag(tag: string, limit = 12): Promise<Destination[]> {
  const response = await fetch(`${API_BASE_URL}/api/destinations/by-tag?tag=${encodeURIComponent(tag)}&limit=${limit}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch destinations by tag');
  }

  return response.json();
}

/**
 * Get trending destinations
 */
export async function getTrendingDestinations(): Promise<Destination[]> {
  const response = await fetch(`${API_BASE_URL}/api/destinations/trending`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch trending destinations');
  }

  return response.json();
}

/**
 * Get a surprise/random destination
 */
export async function getSurpriseDestination(profile?: string): Promise<Destination> {
  const url = profile 
    ? `${API_BASE_URL}/api/destinations/surprise?profile=${encodeURIComponent(profile)}`
    : `${API_BASE_URL}/api/destinations/surprise`;
    
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch surprise destination');
  }

  return response.json();
}

/**
 * Get destination details by city
 */
export async function getDestinationByCity(city: string): Promise<DestinationDetail> {
  const response = await fetch(`${API_BASE_URL}/api/destinations/${encodeURIComponent(city)}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch destination');
  }

  return response.json();
}

/**
 * Initialize planner with destination
 */
export async function initializePlanner(destination: string): Promise<DestinationDetail> {
  const response = await fetch(`${API_BASE_URL}/api/planner/init?destination=${encodeURIComponent(destination)}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Init failed' }));
    throw new Error(error.error || 'Failed to initialize planner');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useDestinations(filters?: DestinationFilters) {
  return useQuery({
    queryKey: ['destinations', filters],
    queryFn: () => getDestinations(filters),
    staleTime: 300000, // 5 minutes
  });
}

export function useDestinationsByTag(tag: string | null, limit = 12) {
  return useQuery({
    queryKey: ['destinations-by-tag', tag, limit],
    queryFn: () => getDestinationsByTag(tag!, limit),
    enabled: !!tag,
    staleTime: 300000,
  });
}

export function useTrendingDestinations() {
  return useQuery({
    queryKey: ['destinations-trending'],
    queryFn: getTrendingDestinations,
    staleTime: 3600000, // 1 hour (cached on backend)
  });
}

export function useSurpriseDestination(profile?: string) {
  return useQuery({
    queryKey: ['destination-surprise', profile],
    queryFn: () => getSurpriseDestination(profile),
    staleTime: 0, // Always fetch new
    refetchOnWindowFocus: false,
  });
}

export function useDestinationByCity(city: string | null) {
  return useQuery({
    queryKey: ['destination', city],
    queryFn: () => getDestinationByCity(city!),
    enabled: !!city,
    staleTime: 600000, // 10 minutes
  });
}

export function usePlannerInit(destination: string | null) {
  return useQuery({
    queryKey: ['planner-init', destination],
    queryFn: () => initializePlanner(destination!),
    enabled: !!destination,
    staleTime: 600000,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getCostTierLabel(tier: CostTier): string {
  const labels: Record<CostTier, string> = {
    LOW: 'Budget-Friendly',
    MID: 'Mid-Range',
    HIGH: 'Luxury',
  };
  return labels[tier];
}

export function getCostTierIcon(tier: CostTier): string {
  const icons: Record<CostTier, string> = {
    LOW: '$',
    MID: '$$',
    HIGH: '$$$',
  };
  return icons[tier];
}

export function generateDestinationSlug(city: string, country: string): string {
  return `${city.toLowerCase()}-${country.toLowerCase()}`.replace(/\s+/g, '-');
}
