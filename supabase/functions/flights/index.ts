import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { trackCost } from "../_shared/cost-tracker.ts";

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
  tripId?: string; // Required for search to proceed (cost control)
}

// ============= SUPABASE CLIENT =============
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

// ============= CITY TO AIRPORT CODE RESOLUTION =============
// IMPORTANT: Must be defined before cache helpers which use it
const cityToAirportCode: Record<string, string> = {
  'new york': 'JFK', 'nyc': 'JFK', 'manhattan': 'JFK',
  'los angeles': 'LAX', 'la': 'LAX',
  'chicago': 'ORD', 'houston': 'IAH', 'phoenix': 'PHX',
  'philadelphia': 'PHL', 'san antonio': 'SAT', 'san diego': 'SAN',
  'dallas': 'DFW', 'austin': 'AUS', 'san jose': 'SJC',
  'san francisco': 'SFO', 'sf': 'SFO', 'seattle': 'SEA',
  'denver': 'DEN', 'boston': 'BOS', 'washington': 'DCA', 'dc': 'DCA',
  'nashville': 'BNA', 'detroit': 'DTW', 'portland': 'PDX',
  'las vegas': 'LAS', 'vegas': 'LAS', 'miami': 'MIA',
  'atlanta': 'ATL', 'orlando': 'MCO', 'minneapolis': 'MSP',
  'charlotte': 'CLT', 'tampa': 'TPA', 'pittsburgh': 'PIT',
  'cleveland': 'CLE', 'new orleans': 'MSY', 'honolulu': 'HNL',
  'london': 'LHR', 'paris': 'CDG', 'amsterdam': 'AMS',
  'frankfurt': 'FRA', 'munich': 'MUC', 'berlin': 'BER',
  'rome': 'FCO', 'milan': 'MXP', 'madrid': 'MAD',
  'barcelona': 'BCN', 'lisbon': 'LIS', 'dublin': 'DUB',
  'vienna': 'VIE', 'zurich': 'ZRH', 'geneva': 'GVA',
  'brussels': 'BRU', 'copenhagen': 'CPH', 'stockholm': 'ARN',
  'oslo': 'OSL', 'helsinki': 'HEL', 'prague': 'PRG',
  'warsaw': 'WAW', 'budapest': 'BUD', 'athens': 'ATH',
  'istanbul': 'IST', 'moscow': 'SVO',
  'tokyo': 'NRT', 'osaka': 'KIX', 'seoul': 'ICN',
  'beijing': 'PEK', 'shanghai': 'PVG', 'hong kong': 'HKG',
  'taipei': 'TPE', 'singapore': 'SIN', 'bangkok': 'BKK',
  'kuala lumpur': 'KUL', 'jakarta': 'CGK', 'manila': 'MNL',
  'ho chi minh': 'SGN', 'saigon': 'SGN', 'hanoi': 'HAN',
  'delhi': 'DEL', 'new delhi': 'DEL', 'mumbai': 'BOM', 'bangalore': 'BLR',
  'dubai': 'DXB', 'abu dhabi': 'AUH', 'doha': 'DOH',
  'tel aviv': 'TLV', 'riyadh': 'RUH',
  'sydney': 'SYD', 'melbourne': 'MEL', 'brisbane': 'BNE', 'auckland': 'AKL',
  'toronto': 'YYZ', 'vancouver': 'YVR', 'montreal': 'YUL',
  'mexico city': 'MEX', 'cancun': 'CUN',
  'sao paulo': 'GRU', 'rio de janeiro': 'GIG', 'rio': 'GIG',
  'buenos aires': 'EZE', 'lima': 'LIM', 'bogota': 'BOG', 'santiago': 'SCL',
  'cairo': 'CAI', 'cape town': 'CPT', 'johannesburg': 'JNB',
  'nairobi': 'NBO', 'casablanca': 'CMN', 'marrakech': 'RAK',
};

function resolveToIataCode(input: string): string {
  const normalized = input.toLowerCase().trim();
  
  // Already an IATA code
  if (/^[a-z]{3}$/i.test(normalized)) {
    return normalized.toUpperCase();
  }
  
  // Exact city match
  if (cityToAirportCode[normalized]) {
    return cityToAirportCode[normalized];
  }
  
  // Partial match
  for (const [city, code] of Object.entries(cityToAirportCode)) {
    if (normalized.includes(city) || city.includes(normalized)) {
      return code;
    }
  }
  
  // Fallback: take first 3 chars uppercase
  return input.toUpperCase().slice(0, 3);
}

// ============= CACHE HELPERS =============
const CACHE_TTL_HOURS = 4;

function generateCacheKey(params: FlightSearchParams): string {
  // Resolve city names to IATA codes for consistent caching
  const originCode = resolveToIataCode(params.origin || '');
  const destCode = resolveToIataCode(params.destination || '');
  
  const normalized = {
    o: originCode,
    d: destCode,
    dep: params.departureDate,
    ret: params.returnDate || '',
    pax: params.passengers || 1,
    cabin: (params.cabinClass || 'economy').toLowerCase(),
  };
  return `flight:${normalized.o}:${normalized.d}:${normalized.dep}:${normalized.ret}:${normalized.pax}:${normalized.cabin}`;
}

async function getCachedResults(params: FlightSearchParams): Promise<{ results: any[], returnResults: any[] } | null> {
  try {
    const supabase = getSupabaseAdmin();
    const cacheKey = generateCacheKey(params);
    
    const { data, error } = await supabase
      .from('search_cache')
      .select('results')
      .eq('search_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) {
      console.log('[Flights] Cache miss for key:', cacheKey.substring(0, 30));
      return null;
    }
    
    console.log('[Flights] 🎯 Cache HIT for key:', cacheKey.substring(0, 30));
    return data.results as { results: any[], returnResults: any[] };
  } catch (e) {
    console.warn('[Flights] Cache lookup error:', e);
    return null;
  }
}

async function cacheResults(params: FlightSearchParams, results: { results: any[], returnResults: any[] }): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const cacheKey = generateCacheKey(params);
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('search_cache')
      .upsert({
        search_type: 'flight',
        search_key: cacheKey,
        origin: params.origin?.toUpperCase(),
        destination: params.destination?.toUpperCase(),
        depart_date: params.departureDate,
        return_date: params.returnDate || null,
        adults: params.passengers || 1,
        cabin_class: params.cabinClass || 'economy',
        result_count: results.results.length + results.returnResults.length,
        results: results,
        expires_at: expiresAt,
      }, { onConflict: 'search_key' });
    
    console.log('[Flights] Cached results, expires:', expiresAt);
  } catch (e) {
    console.warn('[Flights] Cache write error:', e);
  }
}

// ============= TOKEN MANAGEMENT =============
let cachedToken: { token: string; expiresAt: number; isProduction: boolean } | null = null;

function isProductionMode(): boolean {
  const mode = Deno.env.get('AMADEUS_MODE') || 'test';
  return mode.toLowerCase() === 'production';
}

function getAmadeusBaseUrl(): string {
  return isProductionMode() 
    ? 'https://api.amadeus.com' 
    : 'https://test.api.amadeus.com';
}

async function getAmadeusToken(): Promise<string> {
  const isProd = isProductionMode();
  
  if (cachedToken && cachedToken.isProduction === isProd && Date.now() < cachedToken.expiresAt - 60000) {
    console.log('[Flights] Using cached token (mode:', isProd ? 'PRODUCTION' : 'TEST', ')');
    return cachedToken.token;
  }

  const apiKey = Deno.env.get('AMADEUS_API_KEY') || Deno.env.get('AMADEUS_CLIENT_ID') || '';
  const apiSecret = Deno.env.get('AMADEUS_API_SECRET') || Deno.env.get('AMADEUS_CLIENT_SECRET') || '';

  if (!apiKey || !apiSecret) {
    console.error('[Flights] Missing credentials');
    throw new Error('Amadeus credentials not configured');
  }

  const baseUrl = getAmadeusBaseUrl();
  console.log('[Flights] Fetching new Amadeus access token (mode:', isProd ? 'PRODUCTION' : 'TEST', ')');
  
  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
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
    isProduction: isProd,
  };

  console.log('[Flights] Token obtained, expires in', data.expires_in, 'seconds');
  return cachedToken.token;
}

// ============= DURATION PARSING =============
function parseDurationToMinutes(isoDuration: string): number {
  if (!isoDuration) return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  return hours * 60 + minutes;
}

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

// NOTE: cityToAirportCode and resolveToIataCode moved to top of file (before cache helpers)

// ============= DATA TRANSFORMATION =============
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
  const hasReturn = offer.itineraries?.length > 1;
  const pricePerDirection = hasReturn ? totalPrice / 2 : totalPrice;

  return {
    id: `${offer.id}-${direction}`,
    offerId: offer.id,
    direction,
    airline: carrierCode,
    airlineName: getAirlineName(carrierCode),
    flightNumber: `${carrierCode}${firstSegment.number || ''}`,
    origin: firstSegment.departure?.iataCode || '',
    destination: lastSegment.arrival?.iataCode || '',
    departureTime: formatTime(firstSegment.departure?.at),
    arrivalTime: formatTime(lastSegment.arrival?.at),
    departureDateTime: firstSegment.departure?.at,
    arrivalDateTime: lastSegment.arrival?.at,
    duration: parseDurationToMinutes(itinerary.duration),
    durationFormatted: formatDuration(itinerary.duration),
    durationRaw: itinerary.duration,
    stops: segments.length - 1,
    stopLocations: segments.length > 1 
      ? segments.slice(0, -1).map((s: any) => s.arrival?.iataCode).filter(Boolean)
      : [],
    price: pricePerDirection,
    totalPrice: totalPrice,
    currency: offer.price?.currency || 'USD',
    cabin: normalizeCabin(offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin),
    cabinClass: offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || 'ECONOMY',
    seatsAvailable: offer.numberOfBookableSeats || 9,
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

// ============= SEARCH FLIGHTS (with caching) =============
async function searchFlights(params: FlightSearchParams): Promise<{ results: any[], returnResults: any[] }> {
  console.log('[Flights] Search params:', JSON.stringify(params));
  
  // STEP 1: Check cache first
  const cached = await getCachedResults(params);
  if (cached) {
    console.log('[Flights] Returning cached results');
    return cached;
  }
  
  // STEP 2: Call Amadeus API
  try {
    const token = await getAmadeusToken();
    
    const originCode = resolveToIataCode(params.origin);
    const destinationCode = resolveToIataCode(params.destination);
    
    console.log(`[Flights] Resolved: ${params.origin} -> ${originCode}, ${params.destination} -> ${destinationCode}`);
    
    const searchParams = new URLSearchParams({
      originLocationCode: originCode,
      destinationLocationCode: destinationCode,
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

    const baseUrl = getAmadeusBaseUrl();
    const response = await fetch(
      `${baseUrl}/v2/shopping/flight-offers?${searchParams}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Flights] API error:', response.status, errorText);
      
      if (response.status === 400 || response.status === 404) {
        console.log('[Flights] Invalid params or no results');
        return { results: [], returnResults: [] };
      }
      
      if (response.status === 429) {
        console.log('[Flights] Rate limited');
        return { results: [], returnResults: [] };
      }
      
      throw new Error(`Flight search failed: ${response.status}`);
    }

    const data = await response.json();
    const offers = data.data || [];
    console.log('[Flights] Got', offers.length, 'offers from Amadeus');

    const results: any[] = [];
    const returnResults: any[] = [];

    for (const offer of offers) {
      const outbound = transformFlightOffer(offer, 'outbound');
      if (outbound) results.push(outbound);

      if (params.returnDate && offer.itineraries?.length > 1) {
        const returnFlight = transformFlightOffer(offer, 'return');
        if (returnFlight) returnResults.push(returnFlight);
      }
    }

    console.log('[Flights] Transformed:', results.length, 'outbound,', returnResults.length, 'return');
    
    // STEP 3: Cache results
    const searchResults = { results, returnResults };
    await cacheResults(params, searchResults);
    
    return searchResults;

  } catch (error) {
    console.error('[Flights] Search error:', error);
    return { results: [], returnResults: [] };
  }
}

// ============= HTTP HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const costTracker = trackCost('flights_search', 'amadeus');

  try {
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[Flights] Request body:', JSON.stringify(body));
      if (body.tripId) costTracker.setTripId(body.tripId);
      
      const { results, returnResults } = await searchFlights(body);
      
      // Track Amadeus API call (1 call per search)
      costTracker.recordAmadeus(1);
      await costTracker.save();
      
      return new Response(JSON.stringify({ 
        flights: results,
        results,
        returnResults,
        success: true,
        source: 'amadeus_test',
        cached: false, // Will be true from cache hits in getCachedResults
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
    
    return new Response(JSON.stringify({ 
      error: message,
      flights: [],
      results: [],
      returnResults: [],
      success: false,
    }), {
      status: 200, // Return 200 with empty results to not break frontend
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
