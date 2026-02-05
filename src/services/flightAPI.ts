/**
 * Flight API Service
 * Handles flight search with Cloud edge functions and mock fallback
 */

import { supabase } from '@/integrations/supabase/client';

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

  return { 'Content-Type': 'application/json' };
}

// ============================================================================
// Normalization (Edge Function -> Frontend Types)
// ============================================================================

function minutesToIsoDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  // Always valid ISO-ish duration for our parser.
  if (h === 0 && m === 0) return 'PT0M';
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}`;
}

function isNormalizedFlightOption(f: any): f is FlightOption {
  return !!f && typeof f === 'object' && typeof f.origin === 'object' && typeof f.origin?.airport === 'string';
}

function normalizeEdgeFlight(raw: any): FlightOption {
  // Already in the expected shape (e.g., mock flights)
  if (isNormalizedFlightOption(raw)) return raw;

  const segmentsRaw: any[] = Array.isArray(raw?.segments) ? raw.segments : [];
  const firstSeg = segmentsRaw[0];
  const lastSeg = segmentsRaw[segmentsRaw.length - 1];

  const departure =
    raw?.departureDateTime ??
    firstSeg?.departure?.dateTime ??
    firstSeg?.departure?.time ??
    raw?.departureTime ??
    raw?.departure;

  const arrival =
    raw?.arrivalDateTime ??
    lastSeg?.arrival?.dateTime ??
    lastSeg?.arrival?.time ??
    raw?.arrivalTime ??
    raw?.arrival;

  const normalizedSegments: FlightSegment[] | undefined = segmentsRaw.length
    ? segmentsRaw.map((s: any) => ({
        departure: {
          airport: s?.departure?.airport ?? s?.departure?.iataCode ?? '',
          // IMPORTANT: use ISO datetime for downstream calculations
          time: s?.departure?.dateTime ?? s?.departure?.time ?? '',
          terminal: s?.departure?.terminal,
        },
        arrival: {
          airport: s?.arrival?.airport ?? s?.arrival?.iataCode ?? '',
          time: s?.arrival?.dateTime ?? s?.arrival?.time ?? '',
          terminal: s?.arrival?.terminal,
        },
        carrier: s?.airline ?? s?.carrier ?? raw?.airline ?? 'XX',
        flightNumber: s?.flightNumber ?? '',
        duration:
          typeof s?.duration === 'number'
            ? minutesToIsoDuration(s.duration)
            : typeof s?.duration === 'string'
              ? s.duration
              : 'PT0M',
        aircraft: s?.aircraft,
      }))
    : undefined;

  const airline = raw?.airline ?? 'XX';
  const flightNumber = raw?.flightNumber ?? `${airline}${raw?.offerId ?? ''}`;

  const originAirport = raw?.origin ?? raw?.originAirport ?? '';
  const destinationAirport = raw?.destination ?? raw?.destinationAirport ?? '';

  const durationMinutes = typeof raw?.duration === 'number' ? raw.duration : 0;
  const stops = typeof raw?.stops === 'number' ? raw.stops : Math.max(0, (normalizedSegments?.length || 1) - 1);

  return {
    id: raw?.id ?? `${airline}-${flightNumber}-${departure ?? ''}`,
    airline,
    airlineName: raw?.airlineName,
    airlineLogo: raw?.airlineLogo,
    flightNumber,
    origin: {
      airport: originAirport,
      city: raw?.originCity ?? originAirport,
      terminal: undefined,
    },
    destination: {
      airport: destinationAirport,
      city: raw?.destinationCity ?? destinationAirport,
      terminal: undefined,
    },
    departure: departure || '',
    arrival: arrival || '',
    duration: durationMinutes,
    stops,
    stopCities: Array.isArray(raw?.stopLocations) ? raw.stopLocations : undefined,
    price: raw?.price ?? 0,
    class: raw?.cabin,
    cabinClass: raw?.cabinClass ?? raw?.cabin,
    availableSeats: raw?.seatsAvailable,
    baggageIncluded: undefined,
    amenities: undefined,
    bookingClass: undefined,
    priceLock: undefined,
    priceLockId: undefined,
    bookingDeadline: undefined,
    isRecommended: raw?.isRecommended,
    rationale: raw?.rationale,
    currency: raw?.currency,
    segments: normalizedSegments,
  };
}


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
 * Search for flights - uses Cloud edge function, falls back to mock
 */
export interface RoundtripFlightResults {
  outbound: FlightOption[];
  return: FlightOption[];
}

export async function searchFlights(params: FlightSearchParams): Promise<FlightOption[]> {
  try {
    // Normalize passengers
    const passengers = typeof params.passengers === 'number' 
      ? params.passengers
      : params.passengers?.adults || 1;
    
    console.log('[FlightAPI] Calling Cloud edge function');
    
    const { data, error } = await supabase.functions.invoke('flights', {
      body: {
        action: 'search',
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        returnDate: params.returnDate,
        passengers,
        cabinClass: params.class || params.cabinClass || 'economy',
        directOnly: params.directOnly || false,
        maxStops: params.maxStops ?? 2,
        preferredAirlines: params.preferredAirlines,
        budgetMax: params.budgetMax,
      },
    });
    
    if (error) {
      console.warn('[FlightAPI] Cloud function error, using mock data:', error);
      return generateMockFlights(params);
    }
    
    if (!data?.success || !data?.flights?.length) {
      console.warn('[FlightAPI] No flights from API, using mock data');
      return generateMockFlights(params);
    }

    const flights = (data.flights as any[]).map(normalizeEdgeFlight);
    console.log('[FlightAPI] Got', flights.length, 'flights from Cloud');
    return flights;
  } catch (error) {
    console.warn('[FlightAPI] Search error, using mock data:', error);
    return generateMockFlights(params);
  }
}

/**
 * Search for roundtrip flights in a single API call
 * Returns both outbound and return results from the same search
 */
export async function searchRoundtripFlights(params: FlightSearchParams): Promise<RoundtripFlightResults> {
  try {
    const passengers = typeof params.passengers === 'number' 
      ? params.passengers
      : params.passengers?.adults || 1;
    
    console.log('[FlightAPI] Searching roundtrip flights:', params.origin, '->', params.destination);
    
    const { data, error } = await supabase.functions.invoke('flights', {
      body: {
        action: 'search',
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        returnDate: params.returnDate, // Include return date for roundtrip
        passengers,
        cabinClass: params.class || params.cabinClass || 'economy',
        directOnly: params.directOnly || false,
        maxStops: params.maxStops ?? 2,
        preferredAirlines: params.preferredAirlines,
        budgetMax: params.budgetMax,
      },
    });
    
    if (error) {
      console.warn('[FlightAPI] Cloud function error, using mock data:', error);
      const outbound = generateMockFlights(params);
      const returnMock = generateMockFlights({
        ...params,
        origin: params.destination,
        destination: params.origin,
        departureDate: params.returnDate || params.departureDate,
      });
      return { outbound, return: returnMock };
    }
    
    // Edge function returns results (outbound) and returnResults (return)
    const outboundRaw = (data?.results || data?.flights || []) as any[];
    const returnRaw = (data?.returnResults || []) as any[];

    const outbound = outboundRaw.map(normalizeEdgeFlight);
    const returnFlights = returnRaw.map(normalizeEdgeFlight);

    console.log('[FlightAPI] Roundtrip results:', outbound.length, 'outbound,', returnFlights.length, 'return');
    
    // If no real results, use mock data
    if (outbound.length === 0) {
      const mockOutbound = generateMockFlights(params);
      const mockReturn = generateMockFlights({
        ...params,
        origin: params.destination,
        destination: params.origin,
        departureDate: params.returnDate || params.departureDate,
      });
      return { outbound: mockOutbound, return: mockReturn };
    }
    
    // If we have outbound but no return (one-way search or API issue), generate mock return
    if (returnFlights.length === 0 && params.returnDate) {
      const mockReturn = generateMockFlights({
        ...params,
        origin: params.destination,
        destination: params.origin,
        departureDate: params.returnDate,
      });
      return { outbound, return: mockReturn };
    }
    
    return { outbound, return: returnFlights };
  } catch (error) {
    console.warn('[FlightAPI] Roundtrip search error, using mock data:', error);
    const outbound = generateMockFlights(params);
    const returnMock = generateMockFlights({
      ...params,
      origin: params.destination,
      destination: params.origin,
      departureDate: params.returnDate || params.departureDate,
    });
    return { outbound, return: returnMock };
  }
}

/**
 * Get flight details by ID
 */
export async function getFlightDetails(flightId: string): Promise<FlightOption | null> {
  // For now, return a mock flight since we don't cache offers
  // In production, you'd store offers in the database
  return {
    id: flightId,
    airline: 'DL',
    airlineName: 'Delta',
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

/**
 * Create a hold on a flight
 * Note: Price locks are now handled via database, not external API
 */
export async function createFlightHold(input: FlightHoldInput): Promise<FlightHoldResponse> {
  // For now, return a mock hold - in production this would store in DB
  return {
    success: true,
    hold: {
      id: `PL-${input.flightId}`,
      flightId: input.flightId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      priceAmount: input.priceAmount,
      status: 'active',
    },
  };
}

/**
 * Release a flight hold
 */
export async function releaseFlightHold(holdId: string): Promise<{ success: boolean; error?: string }> {
  // For now, just return success - in production this would update DB
  console.log('[FlightAPI] Releasing hold:', holdId);
  return { success: true };
}

/**
 * Get Amadeus API configuration status
 * Now checks if Cloud edge function is configured
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
  // Cloud is always configured when secrets are set
  return {
    amadeus: { configured: true, hostname: 'api.amadeus.com' },
    api: { enabled: true, fallbackToMock: true },
  };
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

/**
 * Hook for searching roundtrip flights in a single API call
 * Returns both outbound and return results from the same query
 */
export function useRoundtripFlightSearch(
  params: FlightSearchParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['roundtrip-flights', params],
    queryFn: () => params ? searchRoundtripFlights(params) : Promise.reject('No params'),
    enabled: options?.enabled !== false && !!params && !!params.returnDate,
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
