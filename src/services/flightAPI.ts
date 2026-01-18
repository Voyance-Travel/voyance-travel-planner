/**
 * Flight API Service
 * Handles flight search with backend integration and mock fallback
 */

import { supabase } from '@/integrations/supabase/client';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface FlightSegment {
  departure: {
    airport: string;
    time: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    time: string;
    terminal?: string;
  };
  carrier: string;
  flightNumber: string;
  duration: string;
  aircraft?: string;
}

export interface FlightPassengers {
  adults: number;
  children: number;
  infants: number;
}

export interface FlightPrice {
  amount: number;
  currency: string;
  displayPrice: string;
}

export interface FlightBaggage {
  carry_on: boolean;
  checked: boolean;
  pieces: number;
}

export interface FlightPriceLock {
  id: string;
  expiresAt: string;
  amount: number;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers?: FlightPassengers | number;
  class?: 'economy' | 'premium_economy' | 'business' | 'first';
  directOnly?: boolean;
  maxStops?: number;
  preferredAirlines?: string[];
  budgetMax?: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface FlightOption {
  id: string;
  airline: string; // IATA carrier code (e.g., "UA", "DL")
  airlineName?: string; // Full airline name (e.g., "United Airlines")
  airlineLogo?: string;
  flightNumber: string;
  origin: {
    airport: string;
    city: string;
    terminal?: string | null;
  };
  destination: {
    airport: string;
    city: string;
    terminal?: string;
  };
  departure: string;
  arrival: string;
  departureTime?: string; // Legacy compatibility
  arrivalTime?: string;   // Legacy compatibility
  duration: number; // in minutes
  stops: number;
  stopCities?: string[];
  price: FlightPrice | number;
  class?: string;
  cabinClass?: string;
  availableSeats?: number;
  baggageIncluded?: FlightBaggage;
  amenities?: string[];
  bookingClass?: string;
  priceLock?: FlightPriceLock;
  priceLockId?: string;
  bookingDeadline?: string;
  isRecommended?: boolean;
  rationale?: string[];
  currency?: string;
  segments?: FlightSegment[];
}

export interface FlightSearchResponse {
  success: boolean;
  flights: FlightOption[];
  metadata?: {
    searchId: string;
    searchTime: number;
    source: 'amadeus' | 'mock';
    totalResults: number;
  };
  error?: string;
}

export interface FlightHoldInput {
  flightId: string;
  priceAmount: number;
  currency?: string;
}

export interface FlightHoldResponse {
  success: boolean;
  hold?: {
    id: string;
    flightId: string;
    expiresAt: string;
    priceAmount: number;
    status: string;
  };
  error?: string;
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
// Mock Data Generation (Fallback)
// ============================================================================

const AIRLINES = [
  { code: 'DL', name: 'Delta', logo: '✈️' },
  { code: 'AA', name: 'American', logo: '✈️' },
  { code: 'UA', name: 'United', logo: '✈️' },
  { code: 'BA', name: 'British Airways', logo: '✈️' },
  { code: 'LH', name: 'Lufthansa', logo: '✈️' },
  { code: 'AF', name: 'Air France', logo: '✈️' },
  { code: 'KL', name: 'KLM', logo: '✈️' },
  { code: 'EK', name: 'Emirates', logo: '✈️' },
];

function generateMockFlights(params: FlightSearchParams): FlightOption[] {
  const flights: FlightOption[] = [];
  const cabinClass = params.class || params.cabinClass || 'economy';
  const basePrice = cabinClass === 'business' ? 2500 :
                    cabinClass === 'premium_economy' ? 1200 :
                    cabinClass === 'first' ? 5000 : 450;

  for (let i = 0; i < 8; i++) {
    const airline = AIRLINES[i % AIRLINES.length];
    const stops = params.directOnly ? 0 : (i < 2 ? 0 : i < 5 ? 1 : 2);
    const baseDuration = 480 + Math.floor(Math.random() * 240);
    const duration = baseDuration + stops * 90;
    const priceVariation = 0.8 + Math.random() * 0.6;
    const price = Math.round(basePrice * priceVariation * (1 - stops * 0.1));

    if (params.budgetMax && price > params.budgetMax) continue;

    const departureHour = 6 + (i * 2) % 18;
    const departureDate = new Date(params.departureDate);
    departureDate.setHours(departureHour, Math.floor(Math.random() * 60));
    const arrivalDate = new Date(departureDate.getTime() + duration * 60000);

    flights.push({
      id: `flight-${i + 1}`,
      airline: airline.code, // Use IATA code for logo lookup
      airlineName: airline.name, // Keep full name for display
      airlineLogo: airline.logo,
      flightNumber: `${airline.code}${1000 + Math.floor(Math.random() * 9000)}`,
      origin: {
        airport: params.origin,
        city: params.origin,
        terminal: stops === 0 ? `T${Math.floor(Math.random() * 4) + 1}` : null,
      },
      destination: {
        airport: params.destination,
        city: params.destination,
        terminal: `T${Math.floor(Math.random() * 4) + 1}`,
      },
      departure: departureDate.toISOString(),
      arrival: arrivalDate.toISOString(),
      departureTime: departureDate.toISOString(),
      arrivalTime: arrivalDate.toISOString(),
      duration,
      stops,
      stopCities: stops > 0 ? ['Chicago', 'Denver'].slice(0, stops) : [],
      price: {
        amount: price,
        currency: 'USD',
        displayPrice: `$${price}`,
      },
      class: cabinClass,
      availableSeats: Math.floor(Math.random() * 20) + 1,
      baggageIncluded: {
        carry_on: true,
        checked: cabinClass !== 'economy' || Math.random() > 0.5,
        pieces: cabinClass === 'economy' ? 1 : 2,
      },
      amenities: stops === 0 ? ['WiFi', 'Power', 'Entertainment'] : ['WiFi'],
      isRecommended: i === 2,
      rationale: [
        stops === 0 ? 'Direct flight' : `${stops} stop(s)`,
        'Good timing',
        price < basePrice ? 'Great value' : 'Premium service',
      ],
      priceLock: {
        id: `PL-flight-${i + 1}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        amount: price,
      },
      currency: 'USD',
    });
  }

  return flights.sort((a, b) => {
    const priceA = typeof a.price === 'number' ? a.price : a.price.amount;
    const priceB = typeof b.price === 'number' ? b.price : b.price.amount;
    return priceA - priceB;
  });
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Search for flights - tries backend first, falls back to mock
 */
export async function searchFlights(params: FlightSearchParams): Promise<FlightOption[]> {
  try {
    const headers = await getAuthHeader();
    
    // Normalize passengers
    const passengers = typeof params.passengers === 'number' 
      ? { adults: params.passengers, children: 0, infants: 0 }
      : params.passengers || { adults: 1, children: 0, infants: 0 };
    
    const response = await fetch(`${BACKEND_URL}/api/v1/flights/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        returnDate: params.returnDate,
        passengers,
        class: params.class || params.cabinClass || 'economy',
        directOnly: params.directOnly || false,
        maxStops: params.maxStops ?? 2,
        preferredAirlines: params.preferredAirlines,
        budgetMax: params.budgetMax,
      }),
    });
    
    if (!response.ok) {
      console.warn('[FlightAPI] Backend search failed, using mock data');
      return generateMockFlights(params);
    }
    
    const data: FlightSearchResponse = await response.json();
    return data.flights || [];
  } catch (error) {
    console.warn('[FlightAPI] Search error, using mock data:', error);
    return generateMockFlights(params);
  }
}

/**
 * Get flight details by ID
 */
export async function getFlightDetails(flightId: string): Promise<FlightOption | null> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(`${BACKEND_URL}/api/v1/flights/${flightId}`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.flight || null;
  } catch {
    // Return mock flight for demo purposes
    return {
      id: flightId,
      airline: 'Delta',
      airlineLogo: '✈️',
      flightNumber: 'DL1234',
      origin: { airport: 'JFK', city: 'New York' },
      destination: { airport: 'CDG', city: 'Paris' },
      departure: new Date().toISOString(),
      arrival: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      departureTime: new Date().toISOString(),
      arrivalTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      duration: 480,
      stops: 0,
      price: { amount: 650, currency: 'USD', displayPrice: '$650' },
      isRecommended: true,
      amenities: ['WiFi', 'Power', 'Entertainment', 'Meals'],
      rationale: ['Direct flight', 'Excellent timing', 'Premium service'],
    };
  }
}

/**
 * Create a hold on a flight
 */
export async function createFlightHold(input: FlightHoldInput): Promise<FlightHoldResponse> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(`${BACKEND_URL}/api/v1/flights/hold`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        flightId: input.flightId,
        priceAmount: input.priceAmount,
        currency: input.currency || 'USD',
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Failed to create hold' };
    }
    
    return response.json();
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create hold' 
    };
  }
}

/**
 * Release a flight hold
 */
export async function releaseFlightHold(holdId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(`${BACKEND_URL}/api/v1/flights/hold/${holdId}`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Failed to release hold' };
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to release hold' 
    };
  }
}

/**
 * Get Amadeus API configuration status
 */
export async function getAmadeusConfig(): Promise<{
  amadeus: {
    configured: boolean;
    hostname?: string;
  };
  api: {
    enabled: boolean;
    fallbackToMock: boolean;
  };
}> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(`${BACKEND_URL}/api/v1/amadeus/config`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      return {
        amadeus: { configured: false },
        api: { enabled: false, fallbackToMock: true },
      };
    }
    
    return response.json();
  } catch {
    return {
      amadeus: { configured: false },
      api: { enabled: false, fallbackToMock: true },
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useFlightSearch(
  params: FlightSearchParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['flights', params],
    queryFn: () => params ? searchFlights(params) : Promise.reject('No params'),
    enabled: options?.enabled !== false && !!params,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useFlightDetails(flightId: string | null) {
  return useQuery({
    queryKey: ['flight', flightId],
    queryFn: () => flightId ? getFlightDetails(flightId) : null,
    enabled: !!flightId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateFlightHold() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createFlightHold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
    },
  });
}

export function useReleaseFlightHold() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: releaseFlightHold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
    },
  });
}

export function useAmadeusConfig() {
  return useQuery({
    queryKey: ['amadeus-config'],
    queryFn: getAmadeusConfig,
    staleTime: Infinity, // Config doesn't change often
  });
}

// ============================================================================
// Export
// ============================================================================

export const flightAPI = {
  searchFlights,
  getFlightDetails,
  createFlightHold,
  releaseFlightHold,
  getAmadeusConfig,
};
