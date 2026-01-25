/**
 * Restaurant Recommendation Service
 * 
 * Provides personalized restaurant recommendations based on:
 * - Real ratings from Google Places, TripAdvisor, Foursquare
 * - User preferences (cuisine, dietary restrictions, budget)
 * - Learned insights from past activity feedback
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string[];
  rating: number;
  reviewCount: number;
  priceLevel: number; // 1-4 ($-$$$$)
  address: string;
  coordinates?: { lat: number; lng: number };
  distance?: number;
  photoUrl?: string;
  website?: string;
  phone?: string;
  openNow?: boolean;
  openingHours?: string[];
  source: 'google' | 'tripadvisor' | 'foursquare';
  sourceId: string;
  dietaryOptions?: string[];
  highlights?: string[];
  reviewSnippets?: string[];
}

export interface ScoredRestaurant extends Restaurant {
  personalizedScore: number;
  scoreBreakdown: {
    baseRating: number;
    cuisineMatch: number;
    dietaryFit: number;
    priceFit: number;
    learnedPreference: number;
    popularityBoost: number;
  };
  matchReasons: string[];
}

export interface RecommendationRequest {
  destination: string;
  coordinates?: { lat: number; lng: number };
  date?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
  partySize?: number;
  maxResults?: number;
  budgetLevel?: 'budget' | 'moderate' | 'upscale' | 'fine_dining';
  minRating?: number;
}

export interface RecommendationResponse {
  success: boolean;
  destination: string;
  mealType: string;
  count: number;
  recommendations: ScoredRestaurant[];
  personalizationApplied: boolean;
  sources: {
    google: boolean;
    tripadvisor: boolean;
    foursquare: boolean;
  };
  error?: string;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get personalized restaurant recommendations
 */
export async function getRestaurantRecommendations(
  request: RecommendationRequest
): Promise<RecommendationResponse> {
  try {
    // Get current user ID for personalization
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.functions.invoke('recommend-restaurants', {
      body: {
        ...request,
        userId: user?.id,
      },
    });

    if (error) {
      console.error('[RestaurantService] Error:', error);
      return {
        success: false,
        destination: request.destination,
        mealType: request.mealType || 'any',
        count: 0,
        recommendations: [],
        personalizationApplied: false,
        sources: { google: false, tripadvisor: false, foursquare: false },
        error: error.message,
      };
    }

    return data as RecommendationResponse;
  } catch (error) {
    console.error('[RestaurantService] Exception:', error);
    return {
      success: false,
      destination: request.destination,
      mealType: request.mealType || 'any',
      count: 0,
      recommendations: [],
      personalizationApplied: false,
      sources: { google: false, tripadvisor: false, foursquare: false },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get restaurants for a specific meal slot in an itinerary
 */
export async function getRestaurantsForMealSlot(
  destination: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  coordinates?: { lat: number; lng: number },
  budgetLevel?: string
): Promise<ScoredRestaurant[]> {
  const response = await getRestaurantRecommendations({
    destination,
    mealType,
    coordinates,
    maxResults: 5,
    budgetLevel: budgetLevel as RecommendationRequest['budgetLevel'],
    minRating: 4.0, // Only recommend 4+ star restaurants
  });

  return response.recommendations;
}

/**
 * Get alternative restaurants for an existing meal
 * Useful for the "swap" or "alternative" feature
 */
export async function getAlternativeRestaurants(
  destination: string,
  currentRestaurantName: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  coordinates?: { lat: number; lng: number }
): Promise<ScoredRestaurant[]> {
  const response = await getRestaurantRecommendations({
    destination,
    mealType,
    coordinates,
    maxResults: 6,
    minRating: 4.0, // Only recommend 4+ star restaurants
  });

  // Filter out the current restaurant
  return response.recommendations.filter(
    r => r.name.toLowerCase() !== currentRestaurantName.toLowerCase()
  );
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format price level to display string
 */
export function formatPriceLevel(level: number): string {
  return '$'.repeat(Math.min(4, Math.max(1, level)));
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number | undefined): string | null {
  if (!meters) return null;
  if (meters < 1000) {
    return `${Math.round(meters)}m away`;
  }
  return `${(meters / 1000).toFixed(1)}km away`;
}

/**
 * Get cuisine tags for display (max 3)
 */
export function getCuisineTags(cuisines: string[]): string[] {
  return cuisines
    .filter(c => c.toLowerCase() !== 'restaurant')
    .slice(0, 3)
    .map(c => c.charAt(0).toUpperCase() + c.slice(1));
}

/**
 * Get personalization badge info based on match reasons
 */
export function getPersonalizationBadge(matchReasons: string[]): {
  label: string;
  color: string;
  icon: string;
} | null {
  if (matchReasons.some(r => r.includes('love'))) {
    return { label: 'For You', color: 'bg-rose-500', icon: '❤️' };
  }
  if (matchReasons.some(r => r.includes('budget'))) {
    return { label: 'Budget Match', color: 'bg-emerald-500', icon: '💰' };
  }
  if (matchReasons.some(r => r.includes('Accommodates'))) {
    return { label: 'Dietary Fit', color: 'bg-purple-500', icon: '✓' };
  }
  if (matchReasons.some(r => r.includes('rating'))) {
    return { label: 'Top Rated', color: 'bg-amber-500', icon: '⭐' };
  }
  return null;
}

/**
 * Get source logo URL
 */
export function getSourceLogo(source: 'google' | 'tripadvisor' | 'foursquare'): string {
  const logos = {
    google: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_48x16dp.png',
    tripadvisor: 'https://static.tacdn.com/img2/brand_refresh/Tripadvisor_logomark_green_vertical.svg',
    foursquare: 'https://foursquare.com/img/company/foursquare-logo-mark.png',
  };
  return logos[source];
}

/**
 * Calculate aggregate rating from multiple sources
 */
export function aggregateRatings(restaurants: ScoredRestaurant[]): number {
  if (restaurants.length === 0) return 0;
  
  const weightedSum = restaurants.reduce((sum, r) => {
    // Weight by review count (more reviews = more reliable)
    const weight = Math.log10(r.reviewCount + 1);
    return sum + (r.rating * weight);
  }, 0);
  
  const totalWeight = restaurants.reduce((sum, r) => sum + Math.log10(r.reviewCount + 1), 0);
  
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
}
