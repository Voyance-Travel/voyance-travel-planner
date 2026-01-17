/**
 * Voyance Guides API Service
 * 
 * Integrates with Railway backend guides endpoints:
 * - GET /api/guides - Get all published guides with filtering
 * - GET /api/guides/:slug - Get single guide by slug
 * - GET /api/guides/featured - Get featured guides
 * - GET /api/guides/related/:city - Get guides related to a city
 */

import { useQuery } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface Guide {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image_url: string | null;
  destination_city: string | null;
  destination_country: string | null;
  destination_region: string | null;
  duration: string | null;
  tags: string[] | null;
  featured: boolean;
  best_time_to_visit: string | null;
  created_at: string;
}

export interface FullGuide extends Guide {
  content: string | null;
  author: string | null;
  view_count: number;
  published: boolean;
  updated_at: string;
  meta_description: string | null;
  meta_keywords: string[] | null;
}

export interface GuidesFilters {
  tag?: string;
  city?: string;
  region?: string;
  featured?: boolean;
  limit?: number;
  page?: number;
}

export interface GuidesPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GuidesResponse {
  guides: Guide[];
  pagination: GuidesPagination;
}

export interface FeaturedGuide {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image_url: string | null;
  destination_city: string | null;
  destination_country: string | null;
  tags: string[] | null;
  duration: string | null;
}

export interface RelatedGuide {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image_url: string | null;
  destination_city: string | null;
  destination_country: string | null;
  tags: string[] | null;
}

// ============================================================================
// API Helpers
// ============================================================================

async function guidesApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData._error || errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Guides API
// ============================================================================

/**
 * Get all published guides with optional filtering
 */
export async function getGuides(filters?: GuidesFilters): Promise<GuidesResponse> {
  const params = new URLSearchParams();
  
  if (filters?.tag) params.set('tag', filters.tag);
  if (filters?.city) params.set('city', filters.city);
  if (filters?.region) params.set('region', filters.region);
  if (filters?.featured) params.set('featured', 'true');
  if (filters?.limit) params.set('limit', filters.limit.toString());
  if (filters?.page) params.set('page', filters.page.toString());
  
  const queryString = params.toString();
  const endpoint = `/api/guides${queryString ? `?${queryString}` : ''}`;
  
  return guidesApiRequest<GuidesResponse>(endpoint);
}

/**
 * Get a single guide by slug
 */
export async function getGuide(slug: string): Promise<FullGuide> {
  return guidesApiRequest<FullGuide>(`/api/guides/${slug}`);
}

/**
 * Get featured guides
 */
export async function getFeaturedGuides(limit: number = 4): Promise<FeaturedGuide[]> {
  return guidesApiRequest<FeaturedGuide[]>(`/api/guides/featured?limit=${limit}`);
}

/**
 * Get guides related to a specific city
 */
export async function getRelatedGuides(city: string, limit: number = 3): Promise<RelatedGuide[]> {
  return guidesApiRequest<RelatedGuide[]>(`/api/guides/related/${encodeURIComponent(city)}?limit=${limit}`);
}

// ============================================================================
// React Query Hooks
// ============================================================================

const guidesKeys = {
  all: ['guides'] as const,
  list: (filters?: GuidesFilters) => [...guidesKeys.all, 'list', filters] as const,
  detail: (slug: string) => [...guidesKeys.all, 'detail', slug] as const,
  featured: (limit: number) => [...guidesKeys.all, 'featured', limit] as const,
  related: (city: string, limit: number) => [...guidesKeys.all, 'related', city, limit] as const,
};

export function useGuides(filters?: GuidesFilters) {
  return useQuery({
    queryKey: guidesKeys.list(filters),
    queryFn: () => getGuides(filters),
    staleTime: 30 * 60_000, // 30 minutes - guides don't change often
  });
}

export function useGuide(slug: string | null) {
  return useQuery({
    queryKey: guidesKeys.detail(slug || ''),
    queryFn: () => slug ? getGuide(slug) : Promise.reject('No slug'),
    enabled: !!slug,
    staleTime: 60 * 60_000, // 1 hour
  });
}

export function useFeaturedGuides(limit: number = 4) {
  return useQuery({
    queryKey: guidesKeys.featured(limit),
    queryFn: () => getFeaturedGuides(limit),
    staleTime: 60 * 60_000, // 1 hour
  });
}

export function useRelatedGuides(city: string | null, limit: number = 3) {
  return useQuery({
    queryKey: guidesKeys.related(city || '', limit),
    queryFn: () => city ? getRelatedGuides(city, limit) : Promise.reject('No city'),
    enabled: !!city,
    staleTime: 30 * 60_000, // 30 minutes
  });
}

// Default export
export default {
  getGuides,
  getGuide,
  getFeaturedGuides,
  getRelatedGuides,
};
