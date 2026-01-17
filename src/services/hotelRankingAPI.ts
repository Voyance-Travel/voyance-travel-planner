/**
 * Voyance Hotel Ranking API Service
 * 
 * Integrates with Railway backend hotel ranking endpoints:
 * - GET /api/v1/hotels/ranked - Rank hotels with preferences
 * - POST /api/v1/hotels/ranked - Rank existing hotels with user preferences
 */

import { supabase } from '@/integrations/supabase/client';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

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
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Rank hotels with query parameters (GET)
 */
export async function getRankedHotels(
  params: HotelRankingQueryParams
): Promise<HotelRankingResponse> {
  const headers = await getAuthHeader();
  
  const queryParams = new URLSearchParams({
    destination: params.destination,
    checkin: params.checkin,
    checkout: params.checkout,
  });
  
  if (params.guests !== undefined) {
    queryParams.set('guests', String(params.guests));
  }
  if (params.budget !== undefined) {
    queryParams.set('budget', String(params.budget));
  }
  if (params.budgetRange) {
    queryParams.set('budgetRange', params.budgetRange);
  }
  if (params.page !== undefined) {
    queryParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    queryParams.set('pageSize', String(params.pageSize));
  }
  if (params.amenities?.length) {
    queryParams.set('amenities', params.amenities.join(','));
  }
  if (params.locationPriority) {
    queryParams.set('locationPriority', params.locationPriority);
  }
  if (params.brands?.length) {
    queryParams.set('brands', params.brands.join(','));
  }
  
  const response = await fetch(
    `${BACKEND_URL}/api/v1/hotels/ranked?${queryParams}`,
    { method: 'GET', headers }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Rank existing hotels with user preferences (POST)
 */
export async function rankHotels(
  params: HotelRankingBodyParams
): Promise<HotelRankingResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/hotels/ranked`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';

export function useRankedHotels(
  params: HotelRankingQueryParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['ranked-hotels', params],
    queryFn: () => params ? getRankedHotels(params) : Promise.reject('No params'),
    enabled: options?.enabled !== false && !!params,
    staleTime: 60_000, // 1 minute
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
};

export default hotelRankingAPI;
