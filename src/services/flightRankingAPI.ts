/**
 * Voyance Flight Ranking API Service
 * 
 * Integrates with Railway backend flight ranking endpoints:
 * - GET /api/v1/flights/ranked - Rank flights with preferences
 * - POST /api/v1/flights/ranked - Rank existing flights with user preferences
 */

import { supabase } from '@/integrations/supabase/client';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface FlightRankingPreferences {
  prioritizePrice?: boolean;
  prioritizeTime?: boolean;
  maxLayovers?: number;
  preferredAirlines?: string[];
}

export interface AlternateAirports {
  origin: string[];
  destination: string[];
}

export interface FlightLayover {
  airport: string;
  duration: number;
  terminal?: string;
}

export interface RankedFlight {
  flightId: string;
  airline: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  duration: number;
  stops: number;
  layovers?: FlightLayover[];
  matchScore?: number;
  priceScore?: number;
  timeScore?: number;
  convenienceScore?: number;
  isRecommended?: boolean;
  rationale?: string[];
}

export interface FlightRankingMetadata {
  algorithm: {
    name: string;
    version: string;
    processingTime?: number;
  };
  query: {
    origin: string;
    destination: string;
    departureDate: string;
    preferences?: FlightRankingPreferences;
  };
  timestamp: string;
}

export interface FlightRankingResponse {
  flights: RankedFlight[];
  metadata: FlightRankingMetadata;
}

export interface FlightRankingQueryParams {
  origin: string;
  destination: string;
  departureDate: string;
  prioritizePrice?: boolean;
  prioritizeTime?: boolean;
  maxLayovers?: number;
  preferredAirlines?: string[];
  originAlternates?: string[];
  destinationAlternates?: string[];
}

export interface FlightRankingBodyParams {
  origin: string;
  destination: string;
  departureDate: string;
  preferences?: FlightRankingPreferences;
  alternateAirports?: AlternateAirports;
  existingFlights?: RankedFlight[];
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
 * Rank flights with query parameters (GET)
 */
export async function getRankedFlights(
  params: FlightRankingQueryParams
): Promise<FlightRankingResponse> {
  const headers = await getAuthHeader();
  
  const queryParams = new URLSearchParams({
    origin: params.origin,
    destination: params.destination,
    departureDate: params.departureDate,
  });
  
  if (params.prioritizePrice !== undefined) {
    queryParams.set('prioritizePrice', String(params.prioritizePrice));
  }
  if (params.prioritizeTime !== undefined) {
    queryParams.set('prioritizeTime', String(params.prioritizeTime));
  }
  if (params.maxLayovers !== undefined) {
    queryParams.set('maxLayovers', String(params.maxLayovers));
  }
  if (params.preferredAirlines?.length) {
    queryParams.set('preferredAirlines', params.preferredAirlines.join(','));
  }
  if (params.originAlternates?.length) {
    queryParams.set('originAlternates', params.originAlternates.join(','));
  }
  if (params.destinationAlternates?.length) {
    queryParams.set('destinationAlternates', params.destinationAlternates.join(','));
  }
  
  const response = await fetch(
    `${BACKEND_URL}/api/v1/flights/ranked?${queryParams}`,
    { method: 'GET', headers }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Rank existing flights with user preferences (POST)
 */
export async function rankFlights(
  params: FlightRankingBodyParams
): Promise<FlightRankingResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/flights/ranked`, {
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

import { useQuery, useMutation } from '@tanstack/react-query';

export function useRankedFlights(
  params: FlightRankingQueryParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['ranked-flights', params],
    queryFn: () => params ? getRankedFlights(params) : Promise.reject('No params'),
    enabled: options?.enabled !== false && !!params,
    staleTime: 60_000, // 1 minute
  });
}

export function useRankFlights() {
  return useMutation({
    mutationFn: rankFlights,
  });
}

// ============================================================================
// Export
// ============================================================================

const flightRankingAPI = {
  getRankedFlights,
  rankFlights,
};

export default flightRankingAPI;
