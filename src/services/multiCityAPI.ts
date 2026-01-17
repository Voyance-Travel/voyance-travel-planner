/**
 * Voyance Multi-City API
 * 
 * Multi-city trip planning endpoints:
 * - POST /api/v1/trips/:tripId/add-cities - Generate multi-city options
 * - GET /api/v1/trips/:tripId/multi-city-options - Get saved options
 * - POST /api/v1/trips/:tripId/multi-city-options/:optionId/adjust-nights - Adjust nights
 * - POST /api/v1/trips/:tripId/confirm-multi-city - Confirm booking
 * - GET /api/v1/multi-city/pricing - Get pricing structure
 * - GET /api/v1/multi-city/popular-routes - Get popular routes
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface PotentialCity {
  cityId: string;
  cityName: string;
  countryName: string;
  priority?: number;
}

export interface AddCitiesPreferences {
  maxBudget?: number;
  preferredTransport?: 'flight' | 'train' | 'any';
  mustSeeCities?: string[];
}

export interface MultiCitySegment {
  cityId: string;
  cityName: string;
  countryName: string;
  nights: number;
  arrivalDate: string;
  departureDate: string;
  hotelName?: string;
  hotelPrice?: number;
}

export interface MultiCityOption {
  id: string;
  tier: 'value' | 'balanced' | 'premium';
  totalPerPerson: number;
  currency: string;
  segments: MultiCitySegment[];
  transportDetails: Array<{
    from: string;
    to: string;
    type: 'flight' | 'train';
    price: number;
    duration: string;
  }>;
  features: string[];
}

export interface MultiCityOptionsResponse {
  tripId: string;
  options: MultiCityOption[];
  metadata: {
    baseCreditsUsed: number;
    totalCities: number;
    generatedAt: string;
  };
}

export interface CityAllocation {
  cityId: string;
  nights: number;
}

export interface MultiCityPricingStructure {
  creditModel: {
    singleCity: number;
    twoCities: number;
    threeCities: number;
    fourPlusCities: string;
  };
  tiers: {
    value: TierInfo;
    balanced: TierInfo;
    premium: TierInfo;
  };
}

export interface TierInfo {
  name: string;
  description: string;
  features: string[];
  priceRange: string;
}

export interface PopularRoute {
  id: string;
  name: string;
  cities: string[];
  duration: string;
  popularity: number;
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

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData._error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Multi-City API
// ============================================================================

/**
 * Generate multi-city options for a trip
 */
export async function generateMultiCityOptions(
  tripId: string,
  potentialCities: PotentialCity[],
  preferences?: AddCitiesPreferences
): Promise<MultiCityOptionsResponse> {
  return apiRequest<MultiCityOptionsResponse>(`/api/v1/trips/${tripId}/add-cities`, {
    method: 'POST',
    body: JSON.stringify({ potentialCities, preferences }),
  });
}

/**
 * Get saved multi-city options for a trip
 */
export async function getMultiCityOptions(tripId: string): Promise<{
  tripId: string;
  options: MultiCityOption[];
  expiresAt: string | null;
}> {
  return apiRequest(`/api/v1/trips/${tripId}/multi-city-options`, {
    method: 'GET',
  });
}

/**
 * Adjust night allocations across cities
 */
export async function adjustCityNights(
  tripId: string,
  optionId: string,
  cityAllocations: CityAllocation[]
): Promise<{
  success: boolean;
  optionId: string;
  adjustedAllocations: CityAllocation[];
  totalNights: number;
}> {
  return apiRequest(`/api/v1/trips/${tripId}/multi-city-options/${optionId}/adjust-nights`, {
    method: 'POST',
    body: JSON.stringify({ cityAllocations }),
  });
}

/**
 * Confirm and book multi-city option
 */
export async function confirmMultiCity(
  tripId: string,
  optionId: string,
  selectedCities: CityAllocation[],
  agreedPrice: number
): Promise<{
  success: boolean;
  tripId: string;
  bookingId: string;
  segments: CityAllocation[];
  totalPrice: number;
  creditsUsed: number;
  status: string;
}> {
  return apiRequest(`/api/v1/trips/${tripId}/confirm-multi-city`, {
    method: 'POST',
    body: JSON.stringify({ optionId, selectedCities, agreedPrice }),
  });
}

/**
 * Get multi-city pricing structure
 */
export async function getMultiCityPricing(): Promise<MultiCityPricingStructure> {
  return apiRequest<MultiCityPricingStructure>('/api/v1/multi-city/pricing', {
    method: 'GET',
  });
}

/**
 * Get popular multi-city routes
 */
export async function getPopularRoutes(): Promise<{
  routes: PopularRoute[];
  lastUpdated: string;
}> {
  return apiRequest('/api/v1/multi-city/popular-routes', {
    method: 'GET',
  });
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useMultiCityOptions(tripId: string | undefined) {
  return useQuery({
    queryKey: ['multi-city-options', tripId],
    queryFn: () => getMultiCityOptions(tripId!),
    enabled: !!tripId,
    staleTime: 5 * 60_000,
  });
}

export function useGenerateMultiCityOptions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, potentialCities, preferences }: {
      tripId: string;
      potentialCities: PotentialCity[];
      preferences?: AddCitiesPreferences;
    }) => generateMultiCityOptions(tripId, potentialCities, preferences),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['multi-city-options', tripId] });
    },
  });
}

export function useAdjustCityNights() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, optionId, cityAllocations }: {
      tripId: string;
      optionId: string;
      cityAllocations: CityAllocation[];
    }) => adjustCityNights(tripId, optionId, cityAllocations),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['multi-city-options', tripId] });
    },
  });
}

export function useConfirmMultiCity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, optionId, selectedCities, agreedPrice }: {
      tripId: string;
      optionId: string;
      selectedCities: CityAllocation[];
      agreedPrice: number;
    }) => confirmMultiCity(tripId, optionId, selectedCities, agreedPrice),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['multi-city-options', tripId] });
    },
  });
}

export function useMultiCityPricing() {
  return useQuery({
    queryKey: ['multi-city-pricing'],
    queryFn: getMultiCityPricing,
    staleTime: 24 * 60 * 60_000, // 24 hours
  });
}

export function usePopularRoutes() {
  return useQuery({
    queryKey: ['popular-routes'],
    queryFn: getPopularRoutes,
    staleTime: 60 * 60_000, // 1 hour
  });
}

// ============================================================================
// Export
// ============================================================================

const multiCityAPI = {
  generateOptions: generateMultiCityOptions,
  getOptions: getMultiCityOptions,
  adjustNights: adjustCityNights,
  confirm: confirmMultiCity,
  getPricing: getMultiCityPricing,
  getPopularRoutes,
};

export default multiCityAPI;
