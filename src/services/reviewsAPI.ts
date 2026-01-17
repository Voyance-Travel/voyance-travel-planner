/**
 * Reviews API Service
 * Handles activity/destination reviews, voting, and statistics
 * 
 * API Base: /api/v1/reviews
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ============================================================================
// CONFIG & HELPERS
// ============================================================================

const API_BASE_URL = 'https://voyance-backend.railway.app';

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('Authentication required. Please sign in.');
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result._error || result.error || result.message || `Request failed: ${response.status}`);
  }
  
  return result;
}

// ============================================================================
// TYPES
// ============================================================================

export type TravelType = 'solo' | 'couple' | 'family' | 'friends' | 'business';
export type VoteType = 'helpful' | 'not_helpful';
export type ReviewSortBy = 'recent' | 'helpful' | 'rating_high' | 'rating_low';

export interface ReviewUser {
  id: string;
  handle: string;
  avatarUrl?: string;
}

export interface Review {
  id: string;
  userId: string;
  activityId: string;
  destinationId?: string;
  rating: number;
  title: string;
  content: string;
  pros: string[];
  cons: string[];
  visitDate: string;
  travelType?: TravelType;
  photos: string[];
  helpful: number;
  notHelpful: number;
  locale: string;
  createdAt: string;
  updatedAt: string;
  user?: ReviewUser;
}

export interface CreateReviewInput {
  activityId: string;
  destinationId?: string;
  rating: number;
  title: string;
  content: string;
  pros?: string[];
  cons?: string[];
  visitDate: string;
  travelType?: TravelType;
  photos?: string[];
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  content?: string;
  pros?: string[];
  cons?: string[];
  visitDate?: string;
  travelType?: TravelType;
  photos?: string[];
}

export interface GetReviewsParams {
  activityId?: string;
  destinationId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
  sortBy?: ReviewSortBy;
}

export interface ReviewsResponse {
  status: 'success';
  reviews: Review[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface VoteReviewInput {
  reviewId: string;
  voteType: VoteType;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

const API_BASE = '/api/v1/reviews';

/**
 * Create a new review
 */
export async function createReview(input: CreateReviewInput): Promise<Review> {
  const response = await apiRequest<{ status: string; review: Review }>(
    API_BASE,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  return response.review;
}

/**
 * Get reviews with filtering and pagination
 */
export async function getReviews(params: GetReviewsParams = {}): Promise<ReviewsResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.activityId) searchParams.set('activityId', params.activityId);
  if (params.destinationId) searchParams.set('destinationId', params.destinationId);
  if (params.userId) searchParams.set('userId', params.userId);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  
  const queryString = searchParams.toString();
  const url = queryString ? `${API_BASE}?${queryString}` : API_BASE;
  
  return apiRequest<ReviewsResponse>(url);
}

/**
 * Get review statistics for an activity
 */
export async function getReviewStats(activityId: string): Promise<ReviewStats> {
  const response = await apiRequest<{ status: string; stats: ReviewStats }>(
    `${API_BASE}/stats/${activityId}`
  );
  return response.stats;
}

/**
 * Vote on a review (helpful/not helpful)
 */
export async function voteReview(input: VoteReviewInput): Promise<void> {
  await apiRequest<{ status: string; message: string }>(
    `${API_BASE}/vote`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

/**
 * Update a review
 */
export async function updateReview(reviewId: string, input: UpdateReviewInput): Promise<Review> {
  const response = await apiRequest<{ status: string; review: Review }>(
    `${API_BASE}/${reviewId}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
  return response.review;
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<void> {
  await apiRequest<{ status: string }>(
    `${API_BASE}/${reviewId}`,
    {
      method: 'DELETE',
    }
  );
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export const reviewKeys = {
  all: ['reviews'] as const,
  list: (params: GetReviewsParams) => [...reviewKeys.all, 'list', params] as const,
  activity: (activityId: string) => [...reviewKeys.all, 'activity', activityId] as const,
  destination: (destinationId: string) => [...reviewKeys.all, 'destination', destinationId] as const,
  user: (userId: string) => [...reviewKeys.all, 'user', userId] as const,
  stats: (activityId: string) => [...reviewKeys.all, 'stats', activityId] as const,
};

/**
 * Hook to fetch reviews with filtering
 */
export function useReviews(params: GetReviewsParams = {}) {
  return useQuery({
    queryKey: reviewKeys.list(params),
    queryFn: () => getReviews(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch reviews for a specific activity
 */
export function useActivityReviews(activityId: string | null, options?: { sortBy?: ReviewSortBy; limit?: number }) {
  return useQuery({
    queryKey: reviewKeys.activity(activityId || ''),
    queryFn: () => getReviews({ 
      activityId: activityId!, 
      sortBy: options?.sortBy || 'recent',
      limit: options?.limit || 10,
    }),
    enabled: !!activityId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch review statistics
 */
export function useReviewStats(activityId: string | null) {
  return useQuery({
    queryKey: reviewKeys.stats(activityId || ''),
    queryFn: () => getReviewStats(activityId!),
    enabled: !!activityId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to create a review
 */
export function useCreateReview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createReview,
    onSuccess: (review) => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.activity(review.activityId) });
      queryClient.invalidateQueries({ queryKey: reviewKeys.stats(review.activityId) });
      if (review.destinationId) {
        queryClient.invalidateQueries({ queryKey: reviewKeys.destination(review.destinationId) });
      }
      toast.success('Review submitted successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit review');
    },
  });
}

/**
 * Hook to update a review
 */
export function useUpdateReview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ reviewId, input }: { reviewId: string; input: UpdateReviewInput }) =>
      updateReview(reviewId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all });
      toast.success('Review updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update review');
    },
  });
}

/**
 * Hook to delete a review
 */
export function useDeleteReview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all });
      toast.success('Review deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete review');
    },
  });
}

/**
 * Hook to vote on a review
 */
export function useVoteReview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: voteReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to record vote');
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get star rating display (filled/empty stars)
 */
export function getStarRating(rating: number): string {
  const filled = '★'.repeat(Math.round(rating));
  const empty = '☆'.repeat(5 - Math.round(rating));
  return filled + empty;
}

/**
 * Get rating label based on score
 */
export function getRatingLabel(rating: number): string {
  if (rating >= 4.5) return 'Excellent';
  if (rating >= 4) return 'Very Good';
  if (rating >= 3) return 'Good';
  if (rating >= 2) return 'Fair';
  return 'Poor';
}

/**
 * Get travel type label
 */
export function getTravelTypeLabel(type: TravelType): string {
  const labels: Record<TravelType, string> = {
    solo: 'Solo Traveler',
    couple: 'Couple',
    family: 'Family',
    friends: 'Friends',
    business: 'Business',
  };
  return labels[type] || type;
}

/**
 * Format review date for display
 */
export function formatReviewDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

/**
 * Calculate helpfulness percentage
 */
export function getHelpfulnessPercentage(helpful: number, notHelpful: number): number {
  const total = helpful + notHelpful;
  if (total === 0) return 0;
  return Math.round((helpful / total) * 100);
}
