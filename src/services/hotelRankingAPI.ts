/**
 * Voyance Hotel Ranking API Service
 * 
 * Hotel ranking - now client-side scoring.
 * No longer depends on Railway backend.
 */

import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface HotelUserPreferences {
  budgetRange?: 'budget' | 'mid-range' | 'luxury';
  preferredAmenities?: string[];
  locationPriority?: 'city-center' | 'airport' | 'attractions' | 'quiet';
  brandLoyalty?: string[];
  accessibility?: string[];
}

export interface HotelLocation {
  address: string;
  distance?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
}

export interface RankedHotel {
  id: string;
  name: string;
  stars?: number;
  price: number;
  currency?: string;
  location: HotelLocation;
  amenities: string[];
  brand?: string;
  rating?: number;
  reviewCount?: number;
  image?: string;
  description?: string;
  availability: boolean;
  matchScore?: number;
  priceScore?: number;
  locationScore?: number;
  amenityScore?: number;
  isRecommended?: boolean;
  rationale?: string[];
}

export interface HotelRankingPagination {
  page: number;
  pageSize: number;
  totalHotels: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface HotelRankingMetadata {
  algorithm: {
    name: string;
    version: string;
    processingTime?: number;
  };
  query: {
    destination: string;
    checkin: string;
    checkout: string;
    guests: number;
    budget?: number;
    userPreferences?: HotelUserPreferences;
  };
  pagination: HotelRankingPagination;
  timestamp: string;
}

export interface HotelRankingResponse {
  hotels: RankedHotel[];
  metadata: HotelRankingMetadata;
}

export interface HotelRankingQueryParams {
  destination: string;
  checkin: string;
  checkout: string;
  guests?: number;
  budget?: number;
  budgetRange?: 'budget' | 'mid-range' | 'luxury';
  page?: number;
  pageSize?: number;
  amenities?: string[];
  locationPriority?: 'city-center' | 'airport' | 'attractions' | 'quiet';
  brands?: string[];
}

export interface HotelRankingBodyParams {
  destination: string;
  checkin: string;
  checkout: string;
  guests?: number;
  budget?: number;
  page?: number;
  pageSize?: number;
  userPreferences?: HotelUserPreferences;
  existingHotels?: RankedHotel[];
}

// ============================================================================
// Client-Side Ranking Logic
// ============================================================================

function scorePrice(price: number, allPrices: number[], preferences?: HotelUserPreferences): number {
  if (allPrices.length === 0) return 50;
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  if (max === min) return 100;

  const normalizedScore = 100 - ((price - min) / (max - min)) * 100;

  // Adjust based on budget preference
  if (preferences?.budgetRange === 'budget' && price <= min + (max - min) * 0.3) {
    return Math.min(100, normalizedScore + 20);
  }
  if (preferences?.budgetRange === 'luxury' && price >= min + (max - min) * 0.7) {
    return Math.min(100, normalizedScore + 10); // Luxury users care less about price
  }

  return Math.round(normalizedScore);
}

function scoreRating(rating?: number): number {
  if (!rating) return 50;
  return Math.round((rating / 5) * 100);
}

function scoreAmenities(
  hotelAmenities: string[],
  preferredAmenities?: string[]
): number {
  if (!preferredAmenities || preferredAmenities.length === 0) {
    return Math.min(100, hotelAmenities.length * 10);
  }

  const lowerHotelAmenities = hotelAmenities.map(a => a.toLowerCase());
  const matches = preferredAmenities.filter(a =>
    lowerHotelAmenities.some(ha => ha.includes(a.toLowerCase()))
  ).length;

  return Math.round((matches / preferredAmenities.length) * 100);
}

function scoreLocation(hotel: RankedHotel, priority?: string): number {
  // Base score from neighborhood/distance
  let score = 70;

  if (hotel.location.distance) {
    const distanceKm = parseFloat(hotel.location.distance);
    if (!isNaN(distanceKm)) {
      if (distanceKm <= 1) score = 100;
      else if (distanceKm <= 3) score = 85;
      else if (distanceKm <= 5) score = 70;
      else score = 50;
    }
  }

  // Boost if matches location priority
  if (priority && hotel.location.neighborhood) {
    const neighborhood = hotel.location.neighborhood.toLowerCase();
    if (priority === 'city-center' && (neighborhood.includes('center') || neighborhood.includes('downtown'))) {
      score = Math.min(100, score + 15);
    }
  }

  return score;
}

function calculateMatchScore(
  hotel: RankedHotel,
  preferences: HotelUserPreferences,
  allPrices: number[]
): { matchScore: number; priceScore: number; locationScore: number; amenityScore: number } {
  const priceScore = scorePrice(hotel.price, allPrices, preferences);
  const locationScore = scoreLocation(hotel, preferences.locationPriority);
  const amenityScore = scoreAmenities(hotel.amenities, preferences.preferredAmenities);
  const ratingScore = scoreRating(hotel.rating);

  // Weighted combination
  const weights = {
    price: 0.25,
    location: 0.25,
    amenity: 0.2,
    rating: 0.3,
  };

  const matchScore = Math.round(
    priceScore * weights.price +
    locationScore * weights.location +
    amenityScore * weights.amenity +
    ratingScore * weights.rating
  );

  return { matchScore: Math.min(100, matchScore), priceScore, locationScore, amenityScore };
}

function generateRationale(
  hotel: RankedHotel,
  scores: { priceScore: number; locationScore: number; amenityScore: number },
  preferences: HotelUserPreferences
): string[] {
  const rationale: string[] = [];

  if (hotel.rating && hotel.rating >= 4.5) {
    rationale.push('Highly rated by guests');
  } else if (hotel.rating && hotel.rating >= 4.0) {
    rationale.push('Well-reviewed property');
  }

  if (scores.priceScore >= 80) {
    rationale.push('Excellent value');
  }

  if (scores.locationScore >= 85) {
    rationale.push('Prime location');
  }

  if (hotel.stars && hotel.stars >= 4) {
    rationale.push(`${hotel.stars}-star property`);
  }

  if (preferences.preferredAmenities && scores.amenityScore >= 80) {
    rationale.push('Has your preferred amenities');
  }

  if (preferences.brandLoyalty?.includes(hotel.brand || '')) {
    rationale.push(`Part of ${hotel.brand} family`);
  }

  if (rationale.length === 0) {
    rationale.push('Good option for your stay');
  }

  return rationale;
}

/**
 * Rank hotels client-side
 */
export function rankHotelsClientSide(
  hotels: RankedHotel[],
  preferences: HotelUserPreferences = {}
): RankedHotel[] {
  if (hotels.length === 0) return [];

  const allPrices = hotels.map(h => h.price);

  // Score each hotel
  const scored = hotels.map(hotel => {
    const scores = calculateMatchScore(hotel, preferences, allPrices);
    const rationale = generateRationale(hotel, scores, preferences);

    return {
      ...hotel,
      ...scores,
      rationale,
    };
  });

  // Sort by match score
  scored.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  // Mark top 3 as recommended
  return scored.map((hotel, index) => ({
    ...hotel,
    isRecommended: index < 3,
  }));
}

// ============================================================================
// API Functions (now client-side)
// ============================================================================

/**
 * Rank hotels with query parameters
 */
export async function getRankedHotels(
  params: HotelRankingQueryParams
): Promise<HotelRankingResponse> {
  // Return empty - actual hotel fetching and ranking happens in hotelAPI
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;

  return {
    hotels: [],
    metadata: {
      algorithm: { name: 'voyance-client-ranker', version: '2.0' },
      query: {
        destination: params.destination,
        checkin: params.checkin,
        checkout: params.checkout,
        guests: params.guests || 2,
        budget: params.budget,
        userPreferences: {
          budgetRange: params.budgetRange,
          preferredAmenities: params.amenities,
          locationPriority: params.locationPriority,
          brandLoyalty: params.brands,
        },
      },
      pagination: {
        page,
        pageSize,
        totalHotels: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: page > 1,
      },
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Rank existing hotels with user preferences
 */
export async function rankHotels(
  params: HotelRankingBodyParams
): Promise<HotelRankingResponse> {
  const startTime = Date.now();
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;

  const rankedHotels = rankHotelsClientSide(
    params.existingHotels || [],
    params.userPreferences || {}
  );

  // Paginate
  const start = (page - 1) * pageSize;
  const paginatedHotels = rankedHotels.slice(start, start + pageSize);

  return {
    hotels: paginatedHotels,
    metadata: {
      algorithm: {
        name: 'voyance-client-ranker',
        version: '2.0',
        processingTime: Date.now() - startTime,
      },
      query: {
        destination: params.destination,
        checkin: params.checkin,
        checkout: params.checkout,
        guests: params.guests || 2,
        budget: params.budget,
        userPreferences: params.userPreferences,
      },
      pagination: {
        page,
        pageSize,
        totalHotels: rankedHotels.length,
        totalPages: Math.ceil(rankedHotels.length / pageSize),
        hasNextPage: start + pageSize < rankedHotels.length,
        hasPreviousPage: page > 1,
      },
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useRankedHotels(
  params: HotelRankingQueryParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['ranked-hotels', params],
    queryFn: () => params ? getRankedHotels(params) : Promise.reject('No params'),
    enabled: options?.enabled !== false && !!params,
    staleTime: 60_000,
  });
}

export function useInfiniteRankedHotels(
  params: Omit<HotelRankingQueryParams, 'page'> | null,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery({
    queryKey: ['ranked-hotels-infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      params
        ? getRankedHotels({ ...params, page: pageParam })
        : Promise.reject('No params'),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.metadata.pagination.hasNextPage
        ? lastPage.metadata.pagination.page + 1
        : undefined,
    enabled: options?.enabled !== false && !!params,
    staleTime: 60_000,
  });
}

export function useRankHotels() {
  return useMutation({
    mutationFn: rankHotels,
  });
}

// ============================================================================
// Export
// ============================================================================

const hotelRankingAPI = {
  getRankedHotels,
  rankHotels,
  rankHotelsClientSide,
};

export default hotelRankingAPI;
