/**
 * Destinations Canonical API Service
 * The authoritative destinations endpoint with proper pagination and filtering
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// TYPES
// ============================================================================

export type CostTier = 'LOW' | 'MID' | 'HIGH';
export type DestinationTier = 'TOP' | 'STANDARD' | 'EMERGING';
export type SortOption = 'trending' | 'alphabetical' | 'random';

export interface HeroImage {
  url: string;
  altText: string;
  source: string;
}

export interface CanonicalDestination {
  id: string;
  name: string;
  city: string;
  country: string;
  region: string;
  description: string;
  oneLineHook?: string;
  costTier: CostTier;
  tier: DestinationTier;
  tags: string[];
  featured: boolean;
  stockImageUrl: string;
  heroImage?: HeroImage;
  knownFor: string[];
  pointsOfInterest?: string[];
  timezone: string;
  currencyCode: string;
  temperatureRange: string;
  bestTimeToVisit: string;
  slug?: string;
  hasDetailPage?: boolean;
}

export interface DestinationSearchParams {
  q?: string;
  search?: string;
  region?: string;
  country?: string;
  season?: string;
  budget?: 'low' | 'moderate' | 'luxury' | CostTier;
  activity?: string;
  tag?: string;
  featured?: boolean;
  tier?: DestinationTier;
  page?: number;
  limit?: number;
  sort?: SortOption;
}

export interface PaginatedDestinationsResponse {
  items: CanonicalDestination[];
  page: number;
  totalPages: number;
  totalItems: number;
  // Legacy support
  data?: CanonicalDestination[];
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get destinations with pagination and filters (canonical endpoint)
 */
export async function getCanonicalDestinations(
  params: DestinationSearchParams = {}
): Promise<PaginatedDestinationsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params.q) queryParams.set('q', params.q);
  if (params.search) queryParams.set('search', params.search);
  if (params.region) queryParams.set('region', params.region);
  if (params.country) queryParams.set('country', params.country);
  if (params.season) queryParams.set('season', params.season);
  if (params.budget) queryParams.set('budget', params.budget);
  if (params.activity) queryParams.set('activity', params.activity);
  if (params.tag) queryParams.set('tag', params.tag);
  if (params.featured !== undefined) queryParams.set('featured', String(params.featured));
  if (params.tier) queryParams.set('tier', params.tier);
  if (params.page) queryParams.set('page', String(params.page));
  if (params.limit) queryParams.set('limit', String(params.limit));
  if (params.sort) queryParams.set('sort', params.sort);
  
  const url = `${BACKEND_URL}/api/destinations?${queryParams.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch destinations: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get a single destination by ID
 */
export async function getCanonicalDestination(id: string): Promise<CanonicalDestination> {
  const response = await fetch(`${BACKEND_URL}/api/destinations/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch destination: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.destination || data;
}

/**
 * Get destination by slug
 */
export async function getDestinationBySlug(slug: string): Promise<CanonicalDestination> {
  const response = await fetch(`${BACKEND_URL}/api/destinations/slug/${slug}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch destination: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.destination || data;
}

/**
 * Search destinations (convenience wrapper)
 */
export async function searchCanonicalDestinations(
  query: string,
  limit: number = 10
): Promise<CanonicalDestination[]> {
  const result = await getCanonicalDestinations({ q: query, limit });
  return result.items;
}

/**
 * Get featured destinations
 */
export async function getFeaturedCanonicalDestinations(
  limit: number = 8
): Promise<CanonicalDestination[]> {
  const result = await getCanonicalDestinations({ featured: true, limit });
  return result.items;
}

/**
 * Get top tier destinations
 */
export async function getTopDestinations(limit: number = 10): Promise<CanonicalDestination[]> {
  const result = await getCanonicalDestinations({ tier: 'TOP', limit, sort: 'trending' });
  return result.items;
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook to fetch paginated destinations
 */
export function useCanonicalDestinations(params: DestinationSearchParams = {}) {
  return useQuery({
    queryKey: ['canonical-destinations', params],
    queryFn: () => getCanonicalDestinations(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for infinite scroll destinations
 */
export function useInfiniteDestinations(
  params: Omit<DestinationSearchParams, 'page'> = {}
) {
  return useInfiniteQuery({
    queryKey: ['infinite-destinations', params],
    queryFn: ({ pageParam = 1 }) => getCanonicalDestinations({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to get a single destination
 */
export function useCanonicalDestination(id: string | undefined) {
  return useQuery({
    queryKey: ['canonical-destination', id],
    queryFn: () => getCanonicalDestination(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook to get destination by slug
 */
export function useDestinationBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['destination-slug', slug],
    queryFn: () => getDestinationBySlug(slug!),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook to search destinations
 */
export function useDestinationSearch(query: string, limit: number = 10) {
  return useQuery({
    queryKey: ['destination-search', query, limit],
    queryFn: () => searchCanonicalDestinations(query, limit),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to get featured destinations
 */
export function useFeaturedDestinations(limit: number = 8) {
  return useQuery({
    queryKey: ['featured-destinations', limit],
    queryFn: () => getFeaturedCanonicalDestinations(limit),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook to get top tier destinations
 */
export function useTopDestinations(limit: number = 10) {
  return useQuery({
    queryKey: ['top-destinations', limit],
    queryFn: () => getTopDestinations(limit),
    staleTime: 1000 * 60 * 30,
  });
}

export default {
  getCanonicalDestinations,
  getCanonicalDestination,
  getDestinationBySlug,
  searchCanonicalDestinations,
  getFeaturedCanonicalDestinations,
  getTopDestinations,
};
