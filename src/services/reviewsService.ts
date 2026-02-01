/**
 * Reviews Service
 * 
 * Fetches real reviews from Google Places, TripAdvisor, and Foursquare
 * for restaurants, attractions, hotels, and activities.
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface Review {
  id: string;
  source: 'google' | 'tripadvisor' | 'foursquare';
  authorName: string;
  authorPhoto?: string;
  rating: number; // 1-5
  text: string;
  relativeTime: string;
  publishedAt?: string;
  language?: string;
  photos?: string[];
  travelType?: string;
  visitDate?: string;
  helpful?: number;
}

export interface PlaceDetails {
  name: string;
  address: string;
  rating: number;
  totalReviews: number;
  priceLevel?: number;
  categories?: string[];
  photos?: string[];
  website?: string;
  phone?: string;
  openNow?: boolean;
  openingHours?: string[];
  coordinates?: { lat: number; lng: number };
}

export interface ReviewsResponse {
  success: boolean;
  place: PlaceDetails | null;
  reviews: Review[];
  sources: {
    google: boolean;
    tripadvisor: boolean;
    foursquare: boolean;
  };
  totalFetched: number;
  error?: string;
}

export interface FetchReviewsParams {
  placeName: string;
  destination: string;
  placeType?: 'restaurant' | 'attraction' | 'hotel' | 'activity';
  coordinates?: { lat: number; lng: number };
  maxReviews?: number;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch reviews for a place from multiple sources
 */
export async function fetchReviews(params: FetchReviewsParams): Promise<ReviewsResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-reviews', {
      body: params,
    });

    if (error) {
      console.error('[ReviewsService] Error:', error);
      return {
        success: false,
        place: null,
        reviews: [],
        sources: { google: false, tripadvisor: false, foursquare: false },
        totalFetched: 0,
        error: error.message,
      };
    }

    return data as ReviewsResponse;
  } catch (error) {
    console.error('[ReviewsService] Exception:', error);
    return {
      success: false,
      place: null,
      reviews: [],
      sources: { google: false, tripadvisor: false, foursquare: false },
      totalFetched: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get source display info
 */
export function getSourceInfo(source: 'google' | 'tripadvisor' | 'foursquare'): {
  name: string;
  color: string;
  iconName: string;
} {
  const sources = {
    google: { name: 'Google', color: 'bg-blue-500', iconName: 'Search' },
    tripadvisor: { name: 'TripAdvisor', color: 'bg-green-600', iconName: 'Sparkles' },
    foursquare: { name: 'Foursquare', color: 'bg-pink-500', iconName: 'MapPin' },
  };
  return sources[source];
}

/**
 * Format rating as stars
 */
export function formatRatingStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  return '★'.repeat(fullStars) + (hasHalf ? '½' : '') + '☆'.repeat(5 - fullStars - (hasHalf ? 1 : 0));
}

/**
 * Get rating color class
 */
export function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'text-green-500';
  if (rating >= 4.0) return 'text-emerald-500';
  if (rating >= 3.5) return 'text-yellow-500';
  if (rating >= 3.0) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * Format travel type for display
 */
export function formatTravelType(type?: string): string | null {
  if (!type) return null;
  const types: Record<string, string> = {
    'Solo travel': '🧳 Solo',
    'Couples': '💑 Couple',
    'Family': '👨‍👩‍👧 Family',
    'Friends': '👥 Friends',
    'Business': '💼 Business',
  };
  return types[type] || type;
}

/**
 * Get price level display
 */
export function formatPriceLevel(level?: number): string {
  if (!level) return '';
  return '$'.repeat(Math.min(4, Math.max(1, level)));
}

/**
 * Truncate review text with "Read more"
 */
export function truncateReview(text: string, maxLength = 200): {
  text: string;
  isTruncated: boolean;
} {
  if (text.length <= maxLength) {
    return { text, isTruncated: false };
  }
  const truncated = text.slice(0, maxLength).trim();
  // Try to break at a word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  return {
    text: (lastSpace > maxLength * 0.7 ? truncated.slice(0, lastSpace) : truncated) + '...',
    isTruncated: true,
  };
}

/**
 * Sort reviews by helpfulness and recency
 */
export function sortReviews(
  reviews: Review[],
  sortBy: 'helpful' | 'recent' | 'rating_high' | 'rating_low' = 'helpful'
): Review[] {
  return [...reviews].sort((a, b) => {
    switch (sortBy) {
      case 'helpful':
        return (b.helpful || 0) - (a.helpful || 0);
      case 'recent':
        if (!a.publishedAt || !b.publishedAt) return 0;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      case 'rating_high':
        return b.rating - a.rating;
      case 'rating_low':
        return a.rating - b.rating;
      default:
        return 0;
    }
  });
}

/**
 * Filter reviews by rating
 */
export function filterReviewsByRating(reviews: Review[], minRating: number): Review[] {
  return reviews.filter(r => r.rating >= minRating);
}

/**
 * Get rating distribution
 */
export function getRatingDistribution(reviews: Review[]): Record<number, number> {
  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const review of reviews) {
    const rounded = Math.round(review.rating);
    if (rounded >= 1 && rounded <= 5) {
      distribution[rounded]++;
    }
  }
  return distribution;
}
