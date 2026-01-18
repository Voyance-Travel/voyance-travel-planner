/**
 * Voyance Multi-City API
 * 
 * Multi-city trip planning - stub implementation for future feature.
 * Currently returns placeholder data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
// Stub API Functions - Future Feature
// ============================================================================

/**
 * Generate multi-city options for a trip
 * Note: This is a stub for a future feature
 */
export async function generateMultiCityOptions(
  tripId: string,
  potentialCities: PotentialCity[],
  preferences?: AddCitiesPreferences
): Promise<MultiCityOptionsResponse> {
  // Stub implementation - returns empty options
  console.log('[MultiCityAPI] Feature not yet implemented', { tripId, potentialCities, preferences });
  
  return {
    tripId,
    options: [],
    metadata: {
      baseCreditsUsed: 0,
      totalCities: potentialCities.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Get saved multi-city options for a trip
 */
export async function getMultiCityOptions(tripId: string): Promise<{
  tripId: string;
  options: MultiCityOption[];
  expiresAt: string | null;
}> {
  return {
    tripId,
    options: [],
    expiresAt: null,
  };
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
  const totalNights = cityAllocations.reduce((sum, c) => sum + c.nights, 0);
  
  return {
    success: true,
    optionId,
    adjustedAllocations: cityAllocations,
    totalNights,
  };
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
  throw new Error('Multi-city booking not yet implemented');
}

/**
 * Get multi-city pricing structure
 */
export async function getMultiCityPricing(): Promise<MultiCityPricingStructure> {
  return {
    creditModel: {
      singleCity: 1,
      twoCities: 2,
      threeCities: 3,
      fourPlusCities: '4+',
    },
    tiers: {
      value: {
        name: 'Value',
        description: 'Budget-friendly options',
        features: ['Economy flights', '3-star hotels', 'Basic transfers'],
        priceRange: '$',
      },
      balanced: {
        name: 'Balanced',
        description: 'Best value for comfort',
        features: ['Mix of airlines', '4-star hotels', 'Comfortable transfers'],
        priceRange: '$$',
      },
      premium: {
        name: 'Premium',
        description: 'Luxury experience',
        features: ['Premium airlines', '5-star hotels', 'Private transfers'],
        priceRange: '$$$',
      },
    },
  };
}

/**
 * Get popular multi-city routes
 */
export async function getPopularRoutes(): Promise<{
  routes: PopularRoute[];
  lastUpdated: string;
}> {
  return {
    routes: [
      { id: '1', name: 'Classic Europe', cities: ['Paris', 'Rome', 'Barcelona'], duration: '10 days', popularity: 95 },
      { id: '2', name: 'Southeast Asia', cities: ['Bangkok', 'Hanoi', 'Singapore'], duration: '12 days', popularity: 88 },
      { id: '3', name: 'Japan Highlights', cities: ['Tokyo', 'Kyoto', 'Osaka'], duration: '8 days', popularity: 92 },
    ],
    lastUpdated: new Date().toISOString(),
  };
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
    staleTime: 24 * 60 * 60_000,
  });
}

export function usePopularRoutes() {
  return useQuery({
    queryKey: ['popular-routes'],
    queryFn: getPopularRoutes,
    staleTime: 60 * 60_000,
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
