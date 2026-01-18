/**
 * Voyance Flight Ranking API Service
 * 
 * Flight ranking - now client-side scoring.
 * No longer depends on Railway backend.
 */

import { useQuery, useMutation } from '@tanstack/react-query';

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
// Client-Side Ranking Logic
// ============================================================================

function scorePrice(price: number, allPrices: number[]): number {
  if (allPrices.length === 0) return 50;
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  if (max === min) return 100;
  return Math.round(100 - ((price - min) / (max - min)) * 100);
}

function scoreDuration(duration: number, allDurations: number[]): number {
  if (allDurations.length === 0) return 50;
  const min = Math.min(...allDurations);
  const max = Math.max(...allDurations);
  if (max === min) return 100;
  return Math.round(100 - ((duration - min) / (max - min)) * 100);
}

function scoreStops(stops: number): number {
  if (stops === 0) return 100;
  if (stops === 1) return 70;
  if (stops === 2) return 40;
  return 20;
}

function calculateMatchScore(
  flight: RankedFlight,
  preferences: FlightRankingPreferences,
  allPrices: number[],
  allDurations: number[]
): { matchScore: number; priceScore: number; timeScore: number; convenienceScore: number } {
  const priceScore = scorePrice(flight.price, allPrices);
  const timeScore = scoreDuration(flight.duration, allDurations);
  const convenienceScore = scoreStops(flight.stops);

  let weights = { price: 0.4, time: 0.3, convenience: 0.3 };

  if (preferences.prioritizePrice) {
    weights = { price: 0.6, time: 0.2, convenience: 0.2 };
  } else if (preferences.prioritizeTime) {
    weights = { price: 0.2, time: 0.6, convenience: 0.2 };
  }

  // Airline preference bonus
  let airlineBonus = 0;
  if (preferences.preferredAirlines?.includes(flight.airline)) {
    airlineBonus = 10;
  }

  const matchScore = Math.round(
    priceScore * weights.price +
    timeScore * weights.time +
    convenienceScore * weights.convenience +
    airlineBonus
  );

  return { matchScore: Math.min(100, matchScore), priceScore, timeScore, convenienceScore };
}

function generateRationale(
  flight: RankedFlight,
  scores: { priceScore: number; timeScore: number; convenienceScore: number },
  preferences: FlightRankingPreferences
): string[] {
  const rationale: string[] = [];

  if (scores.priceScore >= 80) {
    rationale.push('Great value for money');
  } else if (scores.priceScore >= 60) {
    rationale.push('Competitively priced');
  }

  if (flight.stops === 0) {
    rationale.push('Direct flight - no layovers');
  } else if (flight.stops === 1) {
    rationale.push('Single convenient connection');
  }

  if (scores.timeScore >= 80) {
    rationale.push('Fastest option available');
  }

  if (preferences.preferredAirlines?.includes(flight.airline)) {
    rationale.push(`Matches your ${flight.airline} preference`);
  }

  if (rationale.length === 0) {
    rationale.push('Solid option for your route');
  }

  return rationale;
}

/**
 * Rank flights client-side
 */
export function rankFlightsClientSide(
  flights: RankedFlight[],
  preferences: FlightRankingPreferences = {}
): RankedFlight[] {
  if (flights.length === 0) return [];

  const allPrices = flights.map(f => f.price);
  const allDurations = flights.map(f => f.duration);

  // Filter by max layovers if specified
  let filtered = flights;
  if (preferences.maxLayovers !== undefined) {
    filtered = flights.filter(f => f.stops <= preferences.maxLayovers!);
  }

  // Score each flight
  const scored = filtered.map(flight => {
    const scores = calculateMatchScore(flight, preferences, allPrices, allDurations);
    const rationale = generateRationale(flight, scores, preferences);

    return {
      ...flight,
      ...scores,
      rationale,
    };
  });

  // Sort by match score
  scored.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  // Mark top 3 as recommended
  return scored.map((flight, index) => ({
    ...flight,
    isRecommended: index < 3,
  }));
}

// ============================================================================
// API Functions (now client-side)
// ============================================================================

/**
 * Rank flights with query parameters
 * Note: This now returns empty results - actual ranking happens client-side
 */
export async function getRankedFlights(
  params: FlightRankingQueryParams
): Promise<FlightRankingResponse> {
  // Return empty - actual flight fetching and ranking happens in flightAPI
  return {
    flights: [],
    metadata: {
      algorithm: { name: 'voyance-client-ranker', version: '2.0' },
      query: {
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        preferences: {
          prioritizePrice: params.prioritizePrice,
          prioritizeTime: params.prioritizeTime,
          maxLayovers: params.maxLayovers,
          preferredAirlines: params.preferredAirlines,
        },
      },
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Rank existing flights with user preferences
 */
export async function rankFlights(
  params: FlightRankingBodyParams
): Promise<FlightRankingResponse> {
  const startTime = Date.now();

  const rankedFlights = rankFlightsClientSide(
    params.existingFlights || [],
    params.preferences || {}
  );

  return {
    flights: rankedFlights,
    metadata: {
      algorithm: {
        name: 'voyance-client-ranker',
        version: '2.0',
        processingTime: Date.now() - startTime,
      },
      query: {
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        preferences: params.preferences,
      },
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useRankedFlights(
  params: FlightRankingQueryParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['ranked-flights', params],
    queryFn: () => params ? getRankedFlights(params) : Promise.reject('No params'),
    enabled: options?.enabled !== false && !!params,
    staleTime: 60_000,
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
  rankFlightsClientSide,
};

export default flightRankingAPI;
