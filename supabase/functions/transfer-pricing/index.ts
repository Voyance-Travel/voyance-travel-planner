import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost } from "../_shared/cost-tracker.ts";
import { googleDistanceMatrix } from "../_shared/google-api.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================================
// TYPES
// ============================================================================

interface TransferPricingRequest {
  origin: string;           // Starting point (e.g., "Rome Fiumicino Airport")
  destination: string;      // End point (e.g., "Hotel Raphael, Rome")
  city: string;             // City for database lookup
  country?: string;         // Country for context
  airportCode?: string;     // IATA code for specific airport lookup
  travelers?: number;       // Number of travelers (affects per-person pricing)
  date?: string;            // ISO date for the transfer
  time?: string;            // Preferred time (e.g., "14:00")
  transferType?: 'airport_arrival' | 'airport_departure' | 'point_to_point';
  preferredModes?: string[]; // e.g., ['taxi', 'train', 'uber', 'private']
}

interface TransferOption {
  id: string;
  mode: string;                    // taxi, train, metro, bus, uber, lyft, private, ferry, walk
  provider?: string;               // Viator, Uber, local operator name
  title: string;
  duration: string;                // "30 min", "1h 15m"
  durationMinutes: number;
  distance?: number;               // km
  pricePerPerson?: number;
  priceTotal: number;
  currency: string;
  priceFormatted: string;
  isBookable: boolean;
  bookingUrl?: string;
  productCode?: string;            // For Viator bookings
  notes?: string;
  trainLine?: string;
  source: 'viator' | 'database' | 'estimated' | 'google';
  confidence: number;              // 0-1 confidence in accuracy
  imageUrl?: string;
}

interface TransferPricingResponse {
  origin: string;
  destination: string;
  city: string;
  options: TransferOption[];
  recommendedOption?: TransferOption;
  googleMapsData?: {
    drivingDuration: string;
    drivingDistance: string;
    transitDuration?: string;
    walkingDuration?: string;
  };
  source: 'live' | 'database' | 'estimated';
  fetchedAt: string;
}

interface ViatorTransferProduct {
  productCode: string;
  title: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
  };
  duration?: {
    fixedDurationInMinutes?: number;
  };
  images?: Array<{
    variants: Array<{
      url: string;
      width: number;
    }>;
  }>;
  rating?: number;
  reviewCount?: number;
  bookingInfo?: {
    url: string;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
};

const formatPrice = (amount: number, currency: string): string => {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥',
    AUD: 'A$', CAD: 'C$', CHF: 'CHF', MXN: 'MX$', BRL: 'R$',
    INR: '₹', THB: '฿', KRW: '₩', SGD: 'S$', HKD: 'HK$',
  };
  const symbol = symbols[currency.toUpperCase()] || currency + ' ';
  return `${symbol}${Math.round(amount)}`;
};

// Per-km base rates for rideshare estimation (varies by city tier)
const getRideshareRates = (city: string, country?: string): { base: number; perKm: number; perMin: number; currency: string } => {
  const cityLower = city.toLowerCase();
  
  // Tier 1: Expensive cities
  if (['new york', 'london', 'tokyo', 'zurich', 'singapore', 'hong kong'].some(c => cityLower.includes(c))) {
    return { base: 5, perKm: 2.5, perMin: 0.5, currency: cityLower.includes('london') ? 'GBP' : 'USD' };
  }
  
  // Tier 2: Major European cities
  if (['paris', 'rome', 'milan', 'barcelona', 'amsterdam', 'berlin', 'madrid'].some(c => cityLower.includes(c))) {
    return { base: 4, perKm: 1.8, perMin: 0.4, currency: 'EUR' };
  }
  
  // Tier 3: Other destinations
  if (['bangkok', 'bali', 'mexico city', 'lisbon', 'prague'].some(c => cityLower.includes(c))) {
    return { base: 2, perKm: 0.8, perMin: 0.2, currency: 'USD' };
  }
  
  // Default mid-tier
  return { base: 3, perKm: 1.5, perMin: 0.3, currency: 'USD' };
};

// ============================================================================
// VIATOR TRANSFER SEARCH
// ============================================================================

async function searchViatorTransfers(
  destination: string,
  city: string,
  apiKey: string,
  date?: string
): Promise<TransferOption[]> {
  try {
    const url = 'https://api.viator.com/partner/products/search';
    
    console.log('[Transfer-Pricing] Searching Viator transfers for:', city);
    
    // Search for transfer-related products
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json;version=2.0',
        'Content-Type': 'application/json',
        'exp-api-key': apiKey,
      },
      body: JSON.stringify({
        filtering: {
          destination: city,
          tags: ['transfers', 'airport-transfers', 'private-transfers'],
        },
        pagination: {
          start: 1,
          count: 10,
        },
        sorting: {
          sort: 'TRAVELER_RATING',
          order: 'DESCENDING',
        },
        currency: 'USD',
      }),
    });

    if (!response.ok) {
      console.error('[Transfer-Pricing] Viator API error:', response.status);
      return [];
    }

    const data = await response.json();
    const products: ViatorTransferProduct[] = data.products || [];
    
    console.log('[Transfer-Pricing] Found', products.length, 'Viator transfer products');

    return products.map((product, index) => ({
      id: `viator-${product.productCode}`,
      mode: product.title.toLowerCase().includes('private') ? 'private' : 
            product.title.toLowerCase().includes('shared') ? 'shared_shuttle' : 'transfer',
      provider: 'Viator',
      title: product.title,
      duration: product.duration?.fixedDurationInMinutes 
        ? formatDuration(product.duration.fixedDurationInMinutes) 
        : 'Varies',
      durationMinutes: product.duration?.fixedDurationInMinutes || 45,
      priceTotal: product.price?.amount || 0,
      currency: product.price?.currency || 'USD',
      priceFormatted: formatPrice(product.price?.amount || 0, product.price?.currency || 'USD'),
      isBookable: true,
      bookingUrl: product.bookingInfo?.url || `https://www.viator.com/tours/${product.productCode}`,
      productCode: product.productCode,
      notes: product.reviewCount ? `${product.rating?.toFixed(1)} ★ (${product.reviewCount} reviews)` : undefined,
      source: 'viator' as const,
      confidence: 0.95,
      imageUrl: product.images?.[0]?.variants?.find(v => v.width >= 300)?.url,
    }));
  } catch (error) {
    console.error('[Transfer-Pricing] Viator search error:', error);
    return [];
  }
}

// ============================================================================
// GOOGLE MAPS DISTANCE
// ============================================================================

interface GoogleMapsResult {
  drivingDuration?: string;
  drivingDurationMinutes?: number;
  drivingDistance?: string;
  drivingDistanceKm?: number;
  transitDuration?: string;
  transitDurationMinutes?: number;
  walkingDuration?: string;
  walkingDurationMinutes?: number;
}

async function getGoogleMapsData(
  origin: string,
  destination: string,
  apiKey: string,
  departureTime?: string
): Promise<GoogleMapsResult> {
  const result: GoogleMapsResult = {};
  
  try {
    // Driving
    const drivingParams = new URLSearchParams({
      origins: origin,
      destinations: destination,
      mode: 'driving',
      departure_time: 'now',
      key: apiKey,
    });
    
    const drivingResp = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${drivingParams.toString()}`
    );
    const drivingData = await drivingResp.json();
    
    if (drivingData.status === 'OK' && drivingData.rows?.[0]?.elements?.[0]?.status === 'OK') {
      const element = drivingData.rows[0].elements[0];
      const seconds = element.duration_in_traffic?.value || element.duration.value;
      const meters = element.distance.value;
      
      result.drivingDurationMinutes = Math.round(seconds / 60);
      result.drivingDuration = formatDuration(result.drivingDurationMinutes);
      result.drivingDistanceKm = Math.round(meters / 1000 * 10) / 10;
      result.drivingDistance = `${result.drivingDistanceKm} km`;
    }
  } catch (e) {
    console.error('[Transfer-Pricing] Google Maps driving error:', e);
  }

  try {
    // Transit
    const transitParams = new URLSearchParams({
      origins: origin,
      destinations: destination,
      mode: 'transit',
      departure_time: departureTime 
        ? Math.floor(new Date(departureTime).getTime() / 1000).toString()
        : 'now',
      key: apiKey,
    });
    
    const transitResp = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${transitParams.toString()}`
    );
    const transitData = await transitResp.json();
    
    if (transitData.status === 'OK' && transitData.rows?.[0]?.elements?.[0]?.status === 'OK') {
      const element = transitData.rows[0].elements[0];
      result.transitDurationMinutes = Math.round(element.duration.value / 60);
      result.transitDuration = formatDuration(result.transitDurationMinutes);
    }
  } catch (e) {
    console.error('[Transfer-Pricing] Google Maps transit error:', e);
  }

  try {
    // Walking (for short distances)
    const walkingParams = new URLSearchParams({
      origins: origin,
      destinations: destination,
      mode: 'walking',
      key: apiKey,
    });
    
    const walkingResp = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${walkingParams.toString()}`
    );
    const walkingData = await walkingResp.json();
    
    if (walkingData.status === 'OK' && walkingData.rows?.[0]?.elements?.[0]?.status === 'OK') {
      const element = walkingData.rows[0].elements[0];
      result.walkingDurationMinutes = Math.round(element.duration.value / 60);
      result.walkingDuration = formatDuration(result.walkingDurationMinutes);
    }
  } catch (e) {
    console.error('[Transfer-Pricing] Google Maps walking error:', e);
  }

  return result;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const costTracker = trackCost('transfer_pricing', 'google_routes');

  try {
    const request: TransferPricingRequest = await req.json();
    const { origin, destination, city, country, airportCode, travelers = 2, date, time, transferType } = request;
    
    if (!origin || !destination || !city) {
      return new Response(
        JSON.stringify({ error: 'origin, destination, and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Transfer-Pricing] Request:', { origin, destination, city, travelers });

    // Initialize services
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const VIATOR_API_KEY = Deno.env.get('VIATOR_API_KEY');

    const options: TransferOption[] = [];
    let googleMapsData: GoogleMapsResult = {};
    let source: 'live' | 'database' | 'estimated' = 'estimated';

    // Step 1: Get Google Maps data for distance/duration
    if (GOOGLE_MAPS_API_KEY) {
      googleMapsData = await getGoogleMapsData(origin, destination, GOOGLE_MAPS_API_KEY, date);
      costTracker.recordGoogleRoutes(3); // driving, transit, walking
      console.log('[Transfer-Pricing] Google Maps data:', googleMapsData);
    }

    // Step 2: Look up curated database fares
    let fareQuery = supabase
      .from('airport_transfer_fares')
      .select('*')
      .ilike('city', city);
    
    if (airportCode) {
      fareQuery = fareQuery.eq('airport_code', airportCode.toUpperCase());
    }

    const { data: fares } = await fareQuery.limit(1);
    const fareRecord = fares?.[0];

    if (fareRecord) {
      console.log('[Transfer-Pricing] Found database fare for:', city);
      source = 'database';
      const symbol = fareRecord.currency_symbol;
      
      // Taxi/Rideshare from database
      if (fareRecord.taxi_cost_min || fareRecord.taxi_cost_max) {
        const taxiCost = fareRecord.taxi_cost_max || fareRecord.taxi_cost_min;
        options.push({
          id: `db-taxi-${city}`,
          mode: 'taxi',
          provider: 'Local Taxi',
          title: fareRecord.taxi_is_fixed_price ? 'Fixed Rate Taxi' : 'Taxi / Rideshare',
          duration: googleMapsData.drivingDuration || 
            (fareRecord.taxi_duration_max ? `${fareRecord.taxi_duration_min}-${fareRecord.taxi_duration_max} min` : '30-45 min'),
          durationMinutes: googleMapsData.drivingDurationMinutes || fareRecord.taxi_duration_max || 40,
          distance: googleMapsData.drivingDistanceKm,
          priceTotal: taxiCost,
          currency: fareRecord.currency,
          priceFormatted: `${symbol}${taxiCost}${fareRecord.taxi_is_fixed_price ? ' fixed' : ''}`,
          isBookable: false,
          notes: fareRecord.taxi_notes || (googleMapsData.drivingDuration ? 'Live traffic duration' : undefined),
          source: 'database',
          confidence: 0.9,
        });
      }

      // Train from database
      if (fareRecord.train_cost) {
        options.push({
          id: `db-train-${city}`,
          mode: 'train',
          provider: fareRecord.train_line || 'Metro/Train',
          title: fareRecord.train_line ? `${fareRecord.train_line} Train` : 'Train / Metro',
          duration: googleMapsData.transitDuration || 
            (fareRecord.train_duration_max ? `${fareRecord.train_duration_min}-${fareRecord.train_duration_max} min` : '30-40 min'),
          durationMinutes: googleMapsData.transitDurationMinutes || fareRecord.train_duration_max || 35,
          pricePerPerson: fareRecord.train_cost,
          priceTotal: fareRecord.train_cost * travelers,
          currency: fareRecord.currency,
          priceFormatted: `${symbol}${fareRecord.train_cost}/person`,
          isBookable: false,
          trainLine: fareRecord.train_line,
          notes: fareRecord.train_notes,
          source: 'database',
          confidence: 0.85,
        });
      }

      // Bus from database
      if (fareRecord.bus_cost) {
        options.push({
          id: `db-bus-${city}`,
          mode: 'bus',
          provider: 'Airport Shuttle',
          title: 'Airport Bus / Shuttle',
          duration: fareRecord.bus_duration_max ? `${fareRecord.bus_duration_min}-${fareRecord.bus_duration_max} min` : '45-60 min',
          durationMinutes: fareRecord.bus_duration_max || 50,
          pricePerPerson: fareRecord.bus_cost,
          priceTotal: fareRecord.bus_cost * travelers,
          currency: fareRecord.currency,
          priceFormatted: `${symbol}${fareRecord.bus_cost}/person`,
          isBookable: false,
          notes: fareRecord.bus_notes,
          source: 'database',
          confidence: 0.8,
        });
      }
    }

    // Step 3: Search Viator for bookable transfers
    if (VIATOR_API_KEY) {
      const viatorOptions = await searchViatorTransfers(destination, city, VIATOR_API_KEY, date);
      if (viatorOptions.length > 0) {
        source = 'live';
        options.push(...viatorOptions);
      }
    }

    // Step 4: Generate estimated options if we have Google Maps data but no database/Viator
    if (options.length === 0 && googleMapsData.drivingDistanceKm) {
      const rates = getRideshareRates(city, country);
      const estimatedCost = Math.round(
        rates.base + 
        (googleMapsData.drivingDistanceKm * rates.perKm) + 
        ((googleMapsData.drivingDurationMinutes || 30) * rates.perMin)
      );

      options.push({
        id: `est-rideshare-${city}`,
        mode: 'uber',
        provider: 'Uber/Lyft',
        title: 'Rideshare (Uber/Lyft)',
        duration: googleMapsData.drivingDuration || '30-45 min',
        durationMinutes: googleMapsData.drivingDurationMinutes || 40,
        distance: googleMapsData.drivingDistanceKm,
        priceTotal: estimatedCost,
        currency: rates.currency,
        priceFormatted: formatPrice(estimatedCost, rates.currency) + ' est.',
        isBookable: false,
        notes: `Estimated based on ${googleMapsData.drivingDistanceKm} km distance`,
        source: 'estimated',
        confidence: 0.6,
      });

      // Add walking if under 2km
      if (googleMapsData.walkingDurationMinutes && googleMapsData.walkingDurationMinutes <= 30) {
        options.push({
          id: `walk-${city}`,
          mode: 'walk',
          title: 'Walk',
          duration: googleMapsData.walkingDuration || '20 min',
          durationMinutes: googleMapsData.walkingDurationMinutes,
          priceTotal: 0,
          currency: 'USD',
          priceFormatted: 'Free',
          isBookable: false,
          source: 'google',
          confidence: 1,
        });
      }

      // Add transit option
      if (googleMapsData.transitDuration) {
        options.push({
          id: `est-transit-${city}`,
          mode: 'transit',
          title: 'Public Transit',
          duration: googleMapsData.transitDuration,
          durationMinutes: googleMapsData.transitDurationMinutes || 40,
          priceTotal: 5, // Generic estimate
          currency: rates.currency,
          priceFormatted: formatPrice(5, rates.currency) + ' est.',
          isBookable: false,
          notes: 'Estimated public transit fare',
          source: 'estimated',
          confidence: 0.5,
        });
      }
    }

    // Step 5: Sort and pick recommended option
    // Priority: bookable > database > estimated, then by value (price/duration)
    options.sort((a, b) => {
      // Bookable first
      if (a.isBookable && !b.isBookable) return -1;
      if (!a.isBookable && b.isBookable) return 1;
      
      // Higher confidence next
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      
      // Then by value (lower price per minute of time saved)
      const aValue = a.priceTotal / Math.max(a.durationMinutes, 1);
      const bValue = b.priceTotal / Math.max(b.durationMinutes, 1);
      return aValue - bValue;
    });

    // Recommended: prefer bookable private transfer or taxi
    const recommendedOption = options.find(o => o.isBookable && o.mode === 'private') 
      || options.find(o => o.mode === 'taxi')
      || options[0];

    const response: TransferPricingResponse = {
      origin,
      destination,
      city,
      options,
      recommendedOption,
      googleMapsData: GOOGLE_MAPS_API_KEY ? {
        drivingDuration: googleMapsData.drivingDuration || 'N/A',
        drivingDistance: googleMapsData.drivingDistance || 'N/A',
        transitDuration: googleMapsData.transitDuration,
        walkingDuration: googleMapsData.walkingDuration,
      } : undefined,
      source,
      fetchedAt: new Date().toISOString(),
    };

    console.log('[Transfer-Pricing] Returning', options.length, 'options, source:', source);

    // Save cost tracking
    await costTracker.save();

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Transfer-Pricing] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: "Transfer pricing failed", code: "PRICING_ERROR" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
