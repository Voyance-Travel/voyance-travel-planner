/**
 * Voyance Explore API
 * 
 * Explore and discovery endpoints:
 * - GET /api/v1/explore/alt-airports - Find alternative airports
 * - GET /api/explore-bundle - Explore content bundle
 * - GET /api/explore-bundle-static - Static explore bundle
 * - GET /api/destinations-bundle - Destinations bundle
 * - GET /api/photo/:photoRef - Proxy Google Places photo
 * - GET /api/photo/static/:location - Static map for location
 */

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface AlternateAirport {
  airport: {
    code: string;
    name: string;
    city: string;
    country: string;
    isHub?: boolean;
    passengerVolume?: number;
  };
  distanceFromOriginMiles: number;
  distanceFromDestinationMiles: number;
  popularityScore: number;
  hubAdvantage: boolean;
  recommendationReason: string;
}

export interface AlternateAirportsResponse {
  success: boolean;
  alternates: AlternateAirport[];
  searchRadius: number;
  totalFound: number;
  error?: string;
}

export interface AlternateAirportsParams {
  origin: string;
  destination: string;
  radius: number;
  hubsOnly?: boolean;
  minVolume?: number;
  maxResults?: number;
}

export interface ExploreDestination {
  id: string;
  name: string;
  country: string;
  imageUrl: string;
  description?: string;
  tags?: string[];
  rating?: number;
}

export interface ExploreBundle {
  version: string;
  generatedAt: string;
  schemaVersion: number;
  spotlight: ExploreDestination[];
  seasonal: {
    spring: ExploreDestination[];
    summer: ExploreDestination[];
    autumn: ExploreDestination[];
    winter: ExploreDestination[];
  };
  style: {
    luxury: ExploreDestination[];
    adventure: ExploreDestination[];
    culture: ExploreDestination[];
    beach: ExploreDestination[];
    urban: ExploreDestination[];
    nature: ExploreDestination[];
  };
}

export interface DestinationsBundle {
  version: string;
  trending: ExploreDestination[];
  budget: ExploreDestination[];
  styles: {
    beach: ExploreDestination[];
    luxury: ExploreDestination[];
    [key: string]: ExploreDestination[];
  };
  all: ExploreDestination[];
}

// ============================================================================
// Alternative Airports API
// ============================================================================

/**
 * Find alternative airports within radius
 */
export async function findAlternateAirports(
  params: AlternateAirportsParams
): Promise<AlternateAirportsResponse> {
  try {
    const queryParams = new URLSearchParams({
      origin: params.origin.toUpperCase(),
      destination: params.destination.toUpperCase(),
      radius: String(params.radius),
    });
    
    if (params.hubsOnly !== undefined) {
      queryParams.append('hubsOnly', String(params.hubsOnly));
    }
    if (params.minVolume !== undefined) {
      queryParams.append('minVolume', String(params.minVolume));
    }
    if (params.maxResults !== undefined) {
      queryParams.append('maxResults', String(params.maxResults));
    }
    
    const response = await fetch(`${BACKEND_URL}/api/v1/explore/alt-airports?${queryParams}`, {
      method: 'GET',
    });
    
    return response.json();
  } catch (error) {
    console.error('[ExploreAPI] Find alternate airports error:', error);
    return {
      success: false,
      alternates: [],
      searchRadius: 0,
      totalFound: 0,
      error: error instanceof Error ? error.message : 'Failed to find alternate airports',
    };
  }
}

// ============================================================================
// Explore Bundle API
// ============================================================================

/**
 * Get explore content bundle
 */
export async function getExploreBundle(): Promise<ExploreBundle | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/explore-bundle`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[ExploreAPI] Get explore bundle error:', error);
    return null;
  }
}

/**
 * Get static explore bundle
 */
export async function getStaticExploreBundle(): Promise<ExploreBundle | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/explore-bundle-static`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[ExploreAPI] Get static explore bundle error:', error);
    return null;
  }
}

/**
 * Get destinations bundle
 */
export async function getDestinationsBundle(): Promise<DestinationsBundle | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/destinations-bundle`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[ExploreAPI] Get destinations bundle error:', error);
    return null;
  }
}

/**
 * Check destinations bundle health
 */
export async function checkDestinationsBundleHealth(): Promise<{
  status: string;
  timestamp: string;
  bundleFile: string;
  totalDestinations: number;
  categories: Record<string, number>;
} | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/destinations-bundle/health`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[ExploreAPI] Destinations bundle health check error:', error);
    return null;
  }
}

// ============================================================================
// Photo Proxy API
// ============================================================================

/**
 * Get proxied photo URL (for Google Places photos)
 */
export function getProxiedPhotoUrl(
  photoRef: string,
  width: number = 1200,
  height: number = 800
): string {
  return `${BACKEND_URL}/api/photo/${encodeURIComponent(photoRef)}?width=${width}&height=${height}`;
}

/**
 * Get static map URL for a location
 */
export function getStaticMapUrl(
  location: string,
  width: number = 1200,
  height: number = 800,
  zoom: number = 12
): string {
  return `${BACKEND_URL}/api/photo/static/${encodeURIComponent(location)}?width=${width}&height=${height}&zoom=${zoom}`;
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation } from '@tanstack/react-query';

export function useAlternateAirports(params: AlternateAirportsParams | null) {
  return useQuery({
    queryKey: ['alternate-airports', params],
    queryFn: () => params ? findAlternateAirports(params) : Promise.resolve({ success: false, alternates: [], searchRadius: 0, totalFound: 0 }),
    enabled: !!params,
    staleTime: 5 * 60_000,
  });
}

export function useFindAlternateAirports() {
  return useMutation({
    mutationFn: (params: AlternateAirportsParams) => findAlternateAirports(params),
  });
}

export function useExploreBundle() {
  return useQuery({
    queryKey: ['explore-bundle'],
    queryFn: getExploreBundle,
    staleTime: 60 * 60_000, // 1 hour
  });
}

export function useStaticExploreBundle() {
  return useQuery({
    queryKey: ['explore-bundle-static'],
    queryFn: getStaticExploreBundle,
    staleTime: 24 * 60 * 60_000, // 24 hours
  });
}

export function useDestinationsBundle() {
  return useQuery({
    queryKey: ['destinations-bundle'],
    queryFn: getDestinationsBundle,
    staleTime: 24 * 60 * 60_000, // 24 hours
  });
}

// ============================================================================
// Export
// ============================================================================

const exploreAPI = {
  // Airports
  findAlternateAirports,
  
  // Bundles
  getExploreBundle,
  getStaticExploreBundle,
  getDestinationsBundle,
  checkDestinationsBundleHealth,
  
  // Photo proxy
  getProxiedPhotoUrl,
  getStaticMapUrl,
};

export default exploreAPI;
