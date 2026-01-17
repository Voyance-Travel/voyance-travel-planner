/**
 * Tags/Emotional Tags API Service
 * 
 * Handles tag searching with input sanitization and query limits.
 */

import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export type TagCategory = 'all' | 'celebration' | 'wellness' | 'adventure' | 'romance' | 'family';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  synonyms?: string[];
  relatedActivities?: string[];
  emotionalIntent?: string | null;
  popularityScore?: number;
}

export interface TagSearchParams {
  query: string;
  limit?: number;
  offset?: number;
  category?: TagCategory;
}

export interface TagSearchResponse {
  tags: Tag[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface PopularTagsResponse {
  tags: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    popularityScore: number;
  }>;
}

export interface CategoryTagsResponse {
  category: string;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    emotionalIntent?: string | null;
  }>;
}

export interface AutocompleteResponse {
  suggestions: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Search tags by query
 */
export async function searchTags(params: TagSearchParams): Promise<TagSearchResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set('query', params.query);
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());
  if (params.category) queryParams.set('category', params.category);

  const response = await fetch(`${API_BASE_URL}/api/v1/tags/search?${queryParams}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(error.error || 'Failed to search tags');
  }

  return response.json();
}

/**
 * Get popular tags
 */
export async function getPopularTags(): Promise<PopularTagsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tags/popular`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch popular tags');
  }

  return response.json();
}

/**
 * Get tags by category
 */
export async function getTagsByCategory(category: TagCategory): Promise<CategoryTagsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tags/category/${category}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch category tags');
  }

  return response.json();
}

/**
 * Get tag autocomplete suggestions
 */
export async function getTagAutocomplete(query: string): Promise<AutocompleteResponse> {
  if (query.length < 2) {
    return { suggestions: [] };
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/tags/autocomplete?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Autocomplete failed' }));
    throw new Error(error.error || 'Failed to fetch suggestions');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useTagSearch(params: TagSearchParams | null) {
  return useQuery({
    queryKey: ['tags-search', params],
    queryFn: () => searchTags(params!),
    enabled: !!params && params.query.length >= 2,
    staleTime: 60000,
  });
}

export function usePopularTags() {
  return useQuery({
    queryKey: ['tags-popular'],
    queryFn: getPopularTags,
    staleTime: 300000, // 5 minutes
  });
}

export function useTagsByCategory(category: TagCategory | null) {
  return useQuery({
    queryKey: ['tags-category', category],
    queryFn: () => getTagsByCategory(category!),
    enabled: !!category && category !== 'all',
    staleTime: 300000,
  });
}

export function useTagAutocomplete(query: string) {
  return useQuery({
    queryKey: ['tags-autocomplete', query],
    queryFn: () => getTagAutocomplete(query),
    enabled: query.length >= 2,
    staleTime: 30000,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    celebration: 'bg-yellow-500',
    wellness: 'bg-green-500',
    adventure: 'bg-orange-500',
    romance: 'bg-pink-500',
    family: 'bg-blue-500',
  };
  return colors[category.toLowerCase()] || 'bg-gray-500';
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    celebration: '🎉',
    wellness: '🧘',
    adventure: '🏔️',
    romance: '💕',
    family: '👨‍👩‍👧‍👦',
  };
  return icons[category.toLowerCase()] || '🏷️';
}
