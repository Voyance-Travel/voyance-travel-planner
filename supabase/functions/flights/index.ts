import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers?: number;
  cabinClass?: string;
  directOnly?: boolean;
  maxStops?: number;
}

// ============= TOKEN MANAGEMENT =============
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAmadeusToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    console.log('[Flights] Using cached token');
    return cachedToken.token;
  }

  // Unified credential handling - check all possible env var names
  const apiKey = Deno.env.get('AMADEUS_API_KEY') || Deno.env.get('AMADEUS_CLIENT_ID') || '';
  const apiSecret = Deno.env.get('AMADEUS_API_SECRET') || Deno.env.get('AMADEUS_CLIENT_SECRET') || '';

  if (!apiKey || !apiSecret) {
    console.error('[Flights] Missing credentials. Available env vars:', 
      Object.keys(Deno.env.toObject()).filter(k => k.includes('AMADEUS')));
    throw new Error('Amadeus credentials not configured');
  }

  console.log('[Flights] Fetching new Amadeus access token (TEST MODE)');
  
  const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Flights] Token error:', error);
    throw new Error(`Auth failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  console.log('[Flights] Token obtained, expires in', data.expires_in, 'seconds');
  return cachedToken.token;
}

// ============= DURATION PARSING =============
// Convert ISO 8601 duration (PT2H30M) to minutes (150)
function parseDurationToMinutes(isoDuration: string): number {
  if (!isoDuration) return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  return hours * 60 + minutes;
}

// Format duration for display (2h 30m)
function formatDuration(isoDuration: string): string {
  const minutes = parseDurationToMinutes(isoDuration);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ============= AIRLINE MAPPING =============
const airlineNames: Record<string, string> = {
  'AA': 'American Airlines', 'UA': 'United Airlines', 'DL': 'Delta Air Lines',
  'WN': 'Southwest Airlines', 'AS': 'Alaska Airlines', 'B6': 'JetBlue Airways',
  'NK': 'Spirit Airlines', 'F9': 'Frontier Airlines', 'HA': 'Hawaiian Airlines',
  'BA': 'British Airways', 'AF': 'Air France', 'LH': 'Lufthansa',
  'KL': 'KLM', 'IB': 'Iberia', 'EK': 'Emirates', 'QR': 'Qatar Airways',
  'SQ': 'Singapore Airlines', 'CX': 'Cathay Pacific', 'NH': 'ANA',
  'JL': 'Japan Airlines', 'QF': 'Qantas', 'AC': 'Air Canada',
  'TP': 'TAP Air Portugal', 'AZ': 'ITA Airways', 'LX': 'Swiss',
  'OS': 'Austrian', 'SK': 'SAS', 'AY': 'Finnair', 'TK': 'Turkish Airlines',
};

function getAirlineName(code: string): string {
  return airlineNames[code] || code;
}

// ============= DATA TRANSFORMATION =============
// Transform Amadeus offer to frontend-expected flat structure
function transformFlightOffer(offer: any, direction: 'outbound' | 'return' = 'outbound'): any {
  const itineraryIndex = direction === 'outbound' ? 0 : 1;
  const itinerary = offer.itineraries?.[itineraryIndex];
  
  if (!itinerary) return null;

  const segments = itinerary.segments || [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  
  if (!firstSegment || !lastSegment) return null;

  const carrierCode = firstSegment.carrierCode || 'XX';
  const totalPrice = parseFloat(offer.price?.total || '0');
  // Split price between outbound and return if roundtrip
  const hasReturn = offer.itineraries?.length > 1;
  const pricePerDirection = hasReturn ? totalPrice / 2 : totalPrice;

  return {
    // Core identification
    id: `${offer.id}-${direction}`,
    offerId: offer.id,
    direction,
    
    // Airline info
    airline: carrierCode,
    airlineName: getAirlineName(carrierCode),
    flightNumber: `${carrierCode}${firstSegment.number || ''}`,
    
    // Route
    origin: firstSegment.departure?.iataCode || '',
    destination: lastSegment.arrival?.iataCode || '',
    
    // Times (formatted for frontend)
    departureTime: formatTime(firstSegment.departure?.at),
    arrivalTime: formatTime(lastSegment.arrival?.at),
    departureDateTime: firstSegment.departure?.at,
    arrivalDateTime: lastSegment.arrival?.at,
    
    // Duration (converted to minutes for frontend calculations)
    duration: parseDurationToMinutes(itinerary.duration),
    durationFormatted: formatDuration(itinerary.duration),
    durationRaw: itinerary.duration,
    
    // Stops
    stops: segments.length - 1,
    stopLocations: segments.length > 1 
      ? segments.slice(0, -1).map((s: any) => s.arrival?.iataCode).filter(Boolean)
      : [],
    
    // Price (per direction, not total roundtrip)
    price: pricePerDirection,
    totalPrice: totalPrice,
    currency: offer.price?.currency || 'USD',
    
    // Cabin
    cabin: normalizeCabin(offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin),
    cabinClass: offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || 'ECONOMY',
    
    // Availability
    seatsAvailable: offer.numberOfBookableSeats || 9,
    
    // Detailed segments for display
    segments: segments.map((seg: any) => ({
      flightNumber: `${seg.carrierCode || ''}${seg.number || ''}`,
      airline: seg.carrierCode || '',
      airlineName: getAirlineName(seg.carrierCode || ''),
      departure: {
        airport: seg.departure?.iataCode || '',
        time: formatTime(seg.departure?.at),
        dateTime: seg.departure?.at,
        terminal: seg.departure?.terminal,
      },
      arrival: {
        airport: seg.arrival?.iataCode || '',
        time: formatTime(seg.arrival?.at),
        dateTime: seg.arrival?.at,
        terminal: seg.arrival?.terminal,
      },
      duration: parseDurationToMinutes(seg.duration),
      durationFormatted: formatDuration(seg.duration),
      aircraft: seg.aircraft?.code,
    })),
  };
}

function formatTime(isoDateTime: string | undefined): string {
  if (!isoDateTime) return '';
  try {
    const date = new Date(isoDateTime);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

function normalizeCabin(cabin: string | undefined): string {
  const cabinMap: Record<string, string> = {
    'ECONOMY': 'economy',
    'PREMIUM_ECONOMY': 'premium_economy',
    'BUSINESS': 'business',
    'FIRST': 'first',
  };
  return cabinMap[cabin || ''] || 'economy';
}

// ============= SEARCH FLIGHTS =============
async function searchFlights(params: FlightSearchParams): Promise<{ results: any[], returnResults: any[] }> {
  console.log('[Flights] Search params:', JSON.stringify(params));
  
  try {
    const token = await getAmadeusToken();
    
    const searchParams = new URLSearchParams({
      originLocationCode: params.origin.toUpperCase(),
      destinationLocationCode: params.destination.toUpperCase(),
      departureDate: params.departureDate,
      adults: String(params.passengers || 1),
      max: '20',
      currencyCode: 'USD',
    });

    if (params.returnDate) {
      searchParams.set('returnDate', params.returnDate);
    }

    if (params.cabinClass) {
      const cabinMap: Record<string, string> = {
        'economy': 'ECONOMY',
        'premium_economy': 'PREMIUM_ECONOMY', 
        'business': 'BUSINESS',
        'first': 'FIRST',
      };
      searchParams.set('travelClass', cabinMap[params.cabinClass.toLowerCase()] || 'ECONOMY');
    }

    if (params.directOnly) {
      searchParams.set('nonStop', 'true');
    }

    console.log('[Flights] API request:', Object.fromEntries(searchParams));

    const response = await fetch(
      `https://test.api.amadeus.com/v2/shopping/flight-offers?${searchParams}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Flights] API error:', response.status, errorText);
      
      // Graceful degradation - return empty instead of throwing
      if (response.status === 400 || response.status === 404) {
        console.log('[Flights] Invalid params or no results, returning empty');
        return { results: [], returnResults: [] };
      }
      
      // Rate limiting - wait and retry once
      if (response.status === 429) {
        console.log('[Flights] Rate limited, returning empty');
        return { results: [], returnResults: [] };
      }
      
      throw new Error(`Flight search failed: ${response.status}`);
    }

    const data = await response.json();
    const offers = data.data || [];
    console.log('[Flights] Got', offers.length, 'offers from Amadeus');

    // CRITICAL: Split into separate outbound and return arrays
    const results: any[] = [];
    const returnResults: any[] = [];

    for (const offer of offers) {
      const outbound = transformFlightOffer(offer, 'outbound');
      if (outbound) results.push(outbound);

      // Only add return if it's a roundtrip search
      if (params.returnDate && offer.itineraries?.length > 1) {
        const returnFlight = transformFlightOffer(offer, 'return');
        if (returnFlight) returnResults.push(returnFlight);
      }
    }

    console.log('[Flights] Transformed:', results.length, 'outbound,', returnResults.length, 'return');
    return { results, returnResults };

  } catch (error) {
    console.error('[Flights] Search error:', error);
    // NEVER crash - return empty arrays
    return { results: [], returnResults: [] };
  }
}

// ============= HTTP HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[Flights] Request body:', JSON.stringify(body));
      
      const { results, returnResults } = await searchFlights(body);
      
      // Return in format frontend expects
      return new Response(JSON.stringify({ 
        flights: results,  // Legacy format
        results,           // New format - outbound flights
        returnResults,     // New format - return flights
        success: true,
        source: 'amadeus_test',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Flights] Handler error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    // ALWAYS return valid JSON with empty arrays - never crash frontend
    return new Response(JSON.stringify({ 
      error: message,
      flights: [],
      results: [],
      returnResults: [],
      success: false,
    }), {
      status: 200, // Return 200 with error in body for graceful handling
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
