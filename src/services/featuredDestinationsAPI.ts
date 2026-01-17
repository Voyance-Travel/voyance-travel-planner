/**
 * Featured Destinations API Service
 * 
 * Handles fetching and managing featured destinations with trending data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export type FeatureType = 'trending' | 'seasonal' | 'editorial' | 'personalized';

export interface FeaturedDestination {
  id: number;
  destinationId: string;
  city: string;
  country: string;
  imageUrl: string;
  description: string;
  featureType: FeatureType;
  featureReason?: string;
  confidenceScore?: string;
  dataSource?: string;
  metadata?: Record<string, unknown>;
}

export interface FeaturedDestinationsResponse {
  destinations: FeaturedDestination[];
  lastUpdated: string;
  totalFeatured: number;
}

export interface TrendingScore {
  destinationId: string;
  city: string;
  country: string;
  score: number;
  seasonalScore: number;
  searchScore: number;
  bookingScore: number;
}

export interface TrendingScoresResponse {
  scores: TrendingScore[];
  totalDestinations: number;
  calculatedAt: string;
  weights: {
    seasonal: number;
    search: number;
    booking: number;
  };
  error?: string;
}

export interface UpdateFeaturedDestinationInput {
  featureReason?: string;
  confidenceScore?: number | string;
  isActive?: boolean;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get currently featured destinations
 */
export async function getFeaturedDestinations(): Promise<FeaturedDestinationsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/featured-destinations`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch featured destinations');
  }

  return response.json();
}

/**
 * Refresh featured destinations based on current trends
 */
export async function refreshFeaturedDestinations(): Promise<{
  success: boolean;
  message: string;
  timestamp: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/v1/featured-destinations/refresh`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Refresh failed' }));
    throw new Error(error.error || 'Failed to refresh featured destinations');
  }

  return response.json();
}

/**
 * Get detailed trending scores for destinations
 */
export async function getTrendingScores(): Promise<TrendingScoresResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/featured-destinations/trending-scores`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch trending scores');
  }

  return response.json();
}

/**
 * Update a featured destination (admin)
 */
export async function updateFeaturedDestination(
  id: number,
  input: UpdateFeaturedDestinationInput
): Promise<{ success: boolean; destination: FeaturedDestination }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/featured-destinations/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Update failed' }));
    throw new Error(error.error || 'Failed to update featured destination');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useFeaturedDestinations() {
  return useQuery({
    queryKey: ['featured-destinations'],
    queryFn: getFeaturedDestinations,
    staleTime: 300000, // 5 minutes
  });
}

export function useRefreshFeaturedDestinations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshFeaturedDestinations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featured-destinations'] });
      queryClient.invalidateQueries({ queryKey: ['trending-scores'] });
    },
  });
}

export function useTrendingScores() {
  return useQuery({
    queryKey: ['trending-scores'],
    queryFn: getTrendingScores,
    staleTime: 600000, // 10 minutes
  });
}

export function useUpdateFeaturedDestination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateFeaturedDestinationInput }) =>
      updateFeaturedDestination(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featured-destinations'] });
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getFeatureTypeLabel(type: FeatureType): string {
  const labels: Record<FeatureType, string> = {
    trending: 'Trending Now',
    seasonal: 'Seasonal Pick',
    editorial: 'Editor\'s Choice',
    personalized: 'For You',
  };
  return labels[type] || type;
}

export function getFeatureTypeColor(type: FeatureType): string {
  const colors: Record<FeatureType, string> = {
    trending: 'bg-orange-500',
    seasonal: 'bg-green-500',
    editorial: 'bg-purple-500',
    personalized: 'bg-blue-500',
  };
  return colors[type] || 'bg-gray-500';
}

export function formatConfidenceScore(score?: string | number): string {
  if (!score) return 'N/A';
  const numScore = typeof score === 'string' ? parseFloat(score) : score;
  return `${Math.round(numScore * 100)}%`;
}
