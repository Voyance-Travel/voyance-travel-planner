/**
 * Destinations Unified API Service
 * Main destinations endpoint - queries Neon directly with real data
 */

import { useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_VOYANCE_API_URL || '';

// ============================================================================
// TYPES
// ============================================================================

export interface Destination {
  id: string;
  name: string;
  city: string;
  country: string;
  imageUrl: string;
  image_url: string;
  region: string;
  description: string;
  tags: string[];
  featured: boolean;
  costTier?: string;
  tier?: string;
  airportCode?: string;
  alternativeNames?: string[];
}

export interface DestinationsFilterParams {
  season?: string;
  type?: string;
  tag?: string;
  vibe?: string;
  region?: string;
  budget?: 'budget' | 'mid-range' | 'luxury';
  activity?: string;
  sort?: 'popularity' | 'alphabetical';
  page?: number;
  limit?: number;
}

export interface Guide {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  author: string;
  image_url: string;
  excerpt: string;
  category: string;
  reading_time: number;
  destination_city?: string;
  destination_country?: string;
  tags: string[];
  featured: boolean;
  created_at: string;
}

export interface GuidesResponse {
  guides: Guide[];
  total: number;
}

export interface GuideDetail extends Guide {
  content: string;
  published: boolean;
  updated_at: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get destinations with filters
 */
export async function getDestinations(
  params: DestinationsFilterParams = {}
): Promise<Destination[]> {
  const queryParams = new URLSearchParams();
  
  if (params.season) queryParams.set('season', params.season);
  if (params.type) queryParams.set('type', params.type);
  if (params.tag) queryParams.set('tag', params.tag);
  if (params.vibe) queryParams.set('vibe', params.vibe);
  if (params.region) queryParams.set('region', params.region);
  if (params.budget) queryParams.set('budget', params.budget);
  if (params.activity) queryParams.set('activity', params.activity);
  if (params.sort) queryParams.set('sort', params.sort);
  if (params.page) queryParams.set('page', String(params.page));
  if (params.limit) queryParams.set('limit', String(params.limit));
  
  const url = `${API_BASE}/api/destinations?${queryParams.toString()}`;
  
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
 * Get destinations by tag
 */
export async function getDestinationsByTag(tag: string, limit: number = 12): Promise<Destination[]> {
  const response = await fetch(
    `${API_BASE}/api/destinations/by-tag?tag=${encodeURIComponent(tag)}&limit=${limit}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch destinations by tag: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get trending/featured destinations
 */
export async function getTrendingDestinations(): Promise<Destination[]> {
  const response = await fetch(`${API_BASE}/api/destinations/trending`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch trending destinations: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get random surprise destination
 */
export async function getSurpriseDestination(profile?: string): Promise<Destination> {
  const url = profile
    ? `${API_BASE}/api/destinations/surprise?profile=${encodeURIComponent(profile)}`
    : `${API_BASE}/api/destinations/surprise`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch surprise destination: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get all published guides
 */
export async function getGuides(): Promise<GuidesResponse> {
  const response = await fetch(`${API_BASE}/api/guides`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch guides: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get guide by slug
 */
export async function getGuideBySlug(slug: string): Promise<GuideDetail> {
  const response = await fetch(`${API_BASE}/api/guides/${slug}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch guide: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.guide;
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook to fetch destinations with filters
 */
export function useDestinations(params: DestinationsFilterParams = {}) {
  return useQuery({
    queryKey: ['destinations', params],
    queryFn: () => getDestinations(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch destinations by tag
 */
export function useDestinationsByTag(tag: string | undefined, limit: number = 12) {
  return useQuery({
    queryKey: ['destinations-by-tag', tag, limit],
    queryFn: () => getDestinationsByTag(tag!, limit),
    enabled: !!tag,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to fetch trending destinations
 */
export function useTrendingDestinations() {
  return useQuery({
    queryKey: ['destinations-trending'],
    queryFn: getTrendingDestinations,
    staleTime: 1000 * 60 * 60, // 1 hour (cached on backend)
  });
}

/**
 * Hook to get surprise destination
 */
export function useSurpriseDestination(profile?: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ['destination-surprise', profile],
    queryFn: () => getSurpriseDestination(profile),
    enabled,
    staleTime: 0, // Always fresh for surprise
  });
}

/**
 * Hook to fetch guides
 */
export function useGuides() {
  return useQuery({
    queryKey: ['guides'],
    queryFn: getGuides,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook to fetch guide by slug
 */
export function useGuide(slug: string | undefined) {
  return useQuery({
    queryKey: ['guide', slug],
    queryFn: () => getGuideBySlug(slug!),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });
}

export default {
  getDestinations,
  getDestinationsByTag,
  getTrendingDestinations,
  getSurpriseDestination,
  getGuides,
  getGuideBySlug,
};
