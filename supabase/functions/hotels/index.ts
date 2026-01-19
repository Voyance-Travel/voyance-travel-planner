import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HotelSearchParams {
  destination: string;
  cityCode?: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  rooms?: number;
  priceRange?: { min?: number; max?: number };
  starRating?: number[];
  amenities?: string[];
  tripId?: string; // For cost control context
}

// ============= SUPABASE CLIENT =============
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

// ============= CACHE HELPERS =============
const CACHE_TTL_HOURS = 4;

function generateCacheKey(params: HotelSearchParams): string {
  const normalized = {
    d: (params.cityCode || params.destination)?.toUpperCase().trim(),
    in: params.checkIn,
    out: params.checkOut,
    g: params.guests || 1,
    r: params.rooms || 1,
  };
  return `hotel:${normalized.d}:${normalized.in}:${normalized.out}:${normalized.g}:${normalized.r}`;
}

async function getCachedResults(params: HotelSearchParams): Promise<any[] | null> {
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
      console.log('[Hotels] Cache miss for key:', cacheKey.substring(0, 30));
      return null;
    }
    
    console.log('[Hotels] 🎯 Cache HIT for key:', cacheKey.substring(0, 30));
    return data.results as any[];
  } catch (e) {
    console.warn('[Hotels] Cache lookup error:', e);
    return null;
  }
}

async function cacheResults(params: HotelSearchParams, results: any[]): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const cacheKey = generateCacheKey(params);
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('search_cache')
      .upsert({
        search_type: 'hotel',
        search_key: cacheKey,
        origin: null,
        destination: (params.cityCode || params.destination)?.toUpperCase(),
        depart_date: params.checkIn,
        return_date: params.checkOut,
        adults: params.guests || 1,
        cabin_class: null,
        result_count: results.length,
        results: results,
        expires_at: expiresAt,
      }, { onConflict: 'search_key' });
    
    console.log('[Hotels] Cached', results.length, 'hotels, expires:', expiresAt);
  } catch (e) {
    console.warn('[Hotels] Cache write error:', e);
  }
}

// ============= TOKEN MANAGEMENT =============
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAmadeusToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    console.log('[Hotels] Using cached token');
    return cachedToken.token;
  }

  const apiKey = Deno.env.get('AMADEUS_API_KEY') || Deno.env.get('AMADEUS_CLIENT_ID') || '';
  const apiSecret = Deno.env.get('AMADEUS_API_SECRET') || Deno.env.get('AMADEUS_CLIENT_SECRET') || '';

  if (!apiKey || !apiSecret) {
    console.error('[Hotels] Missing credentials');
    throw new Error('Amadeus credentials not configured');
  }

  const isProduction = Deno.env.get('AMADEUS_MODE') === 'production';
  const baseUrl = isProduction ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
  console.log(`[Hotels] Fetching new Amadeus access token (${isProduction ? 'PRODUCTION' : 'TEST'} MODE)`);
  
  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Hotels] Token error:', error);
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  console.log('[Hotels] Token obtained');
  return cachedToken.token;
}

// ============= AIRPORT TO CITY CODE CONVERSION =============
const airportToCityCode: Record<string, string> = {
  'CDG': 'PAR', 'ORY': 'PAR',
  'LHR': 'LON', 'LGW': 'LON', 'STN': 'LON', 'LTN': 'LON', 'LCY': 'LON',
  'JFK': 'NYC', 'LGA': 'NYC', 'EWR': 'NYC',
  'LAX': 'LAX', 'ORD': 'CHI', 'MDW': 'CHI',
  'NRT': 'TYO', 'HND': 'TYO', 'SYD': 'SYD',
  'FCO': 'ROM', 'CIA': 'ROM', 'MXP': 'MIL', 'LIN': 'MIL',
  'BCN': 'BCN', 'MAD': 'MAD', 'LIS': 'LIS', 'AMS': 'AMS',
  'BER': 'BER', 'TXL': 'BER', 'SXF': 'BER',
  'DXB': 'DXB', 'DWC': 'DXB', 'SIN': 'SIN', 'HKG': 'HKG',
  'BKK': 'BKK', 'DMK': 'BKK', 'ICN': 'SEL', 'GMP': 'SEL',
  'MIA': 'MIA', 'SFO': 'SFO', 'OAK': 'SFO', 'SJC': 'SFO',
  'ATL': 'ATL', 'IST': 'IST', 'SAW': 'IST',
  'DUB': 'DUB', 'VIE': 'VIE', 'PRG': 'PRG', 'CPH': 'CPH',
  'ARN': 'STO', 'HEL': 'HEL', 'MUC': 'MUC', 'FRA': 'FRA',
  'ZRH': 'ZRH', 'BRU': 'BRU', 'ATH': 'ATH', 'CAI': 'CAI',
  'BOM': 'BOM', 'DEL': 'DEL', 'PEK': 'BJS', 'PKX': 'BJS',
  'PVG': 'SHA', 'SHA': 'SHA',
};

const cityNameToCode: Record<string, string> = {
  'paris': 'PAR', 'london': 'LON', 'new york': 'NYC', 'new york city': 'NYC',
  'los angeles': 'LAX', 'chicago': 'CHI', 'tokyo': 'TYO', 'sydney': 'SYD',
  'rome': 'ROM', 'milan': 'MIL', 'barcelona': 'BCN', 'madrid': 'MAD',
  'lisbon': 'LIS', 'amsterdam': 'AMS', 'berlin': 'BER', 'dubai': 'DXB',
  'singapore': 'SIN', 'hong kong': 'HKG', 'bangkok': 'BKK', 'seoul': 'SEL',
  'miami': 'MIA', 'san francisco': 'SFO', 'atlanta': 'ATL', 'istanbul': 'IST',
  'dublin': 'DUB', 'vienna': 'VIE', 'prague': 'PRG', 'copenhagen': 'CPH',
  'stockholm': 'STO', 'helsinki': 'HEL', 'munich': 'MUC', 'frankfurt': 'FRA',
  'zurich': 'ZRH', 'brussels': 'BRU', 'athens': 'ATH', 'cairo': 'CAI',
  'mumbai': 'BOM', 'delhi': 'DEL', 'beijing': 'BJS', 'shanghai': 'SHA',
};

function smartConvertToHotelCityCode(input: string): string {
  const normalized = input.toUpperCase().trim();
  
  if (airportToCityCode[normalized]) {
    console.log(`[Hotels] Converting airport ${normalized} to city ${airportToCityCode[normalized]}`);
    return airportToCityCode[normalized];
  }
  
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }
  
  const codeMatch = input.match(/\(([A-Z]{3})\)/);
  if (codeMatch) {
    const extracted = codeMatch[1];
    return airportToCityCode[extracted] || extracted;
  }
  
  const lowerInput = input.toLowerCase().trim();
  for (const [cityName, cityCode] of Object.entries(cityNameToCode)) {
    if (lowerInput.includes(cityName)) {
      console.log(`[Hotels] Found city name ${cityName} -> ${cityCode}`);
      return cityCode;
    }
  }
  
  console.log(`[Hotels] Warning: Using fallback for ${input}`);
  return normalized.substring(0, 3);
}

// ============= FIELD NORMALIZATION =============
function normalizeHotelData(hotel: any, offer: any, params: HotelSearchParams): any {
  const checkIn = new Date(params.checkIn);
  const checkOut = new Date(params.checkOut);
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  
  const totalPrice = parseFloat(offer?.price?.total || '0');
  const pricePerNight = totalPrice > 0 ? totalPrice / nights : 150;
  
  const hotelData = hotel.hotel || hotel;
  
  const photos: string[] = [];
  if (hotelData.media?.length) {
    photos.push(...hotelData.media.map((m: any) => m.uri).filter(Boolean));
  }
  
  return {
    id: hotelData.hotelId || hotelData.id || `hotel-${Date.now()}`,
    hotelId: hotelData.hotelId || hotelData.id,
    name: hotelData.name || 'Hotel',
    address: hotelData.address?.lines?.join(', ') || hotelData.address?.line1 || '',
    city: hotelData.address?.cityName || params.destination,
    location: hotelData.address?.cityName || params.destination,
    neighborhood: hotelData.address?.cityName || 'City Center',
    rating: normalizeRating(hotelData.rating),
    starRating: normalizeRating(hotelData.rating),
    stars: normalizeRating(hotelData.rating),
    pricePerNight: Math.round(pricePerNight),
    totalPrice: totalPrice > 0 ? totalPrice : pricePerNight * nights,
    price: totalPrice > 0 ? totalPrice : pricePerNight * nights,
    currency: offer?.price?.currency || 'USD',
    roomType: offer?.room?.typeEstimated?.category || 'Standard Room',
    bedType: offer?.room?.typeEstimated?.beds || 1,
    description: offer?.room?.description?.text || `Comfortable room in ${hotelData.name || 'the hotel'}`,
    imageUrl: photos[0] || null,
    photos: photos,
    images: photos,
    amenities: Array.isArray(hotelData.amenities) ? hotelData.amenities : [],
    cancellationPolicy: offer?.policies?.cancellation?.description?.text || 'See hotel policy for details',
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    nights,
    latitude: hotelData.geoCode?.latitude || hotelData.latitude,
    longitude: hotelData.geoCode?.longitude || hotelData.longitude,
    reviewScore: hotelData.rating ? hotelData.rating * 2 : 8.0,
    reviewCount: 0,
    website: null,
    googleMapsUrl: null,
    placeId: null,
    source: 'amadeus',
  };
}

function normalizeRating(rating: any): number {
  if (!rating) return 3;
  const num = typeof rating === 'string' ? parseInt(rating, 10) : rating;
  return Math.min(5, Math.max(1, num || 3));
}

// ============= SEARCH HOTELS (with caching) =============
async function searchHotels(params: HotelSearchParams): Promise<any[]> {
  console.log('[Hotels] Search params:', JSON.stringify(params));
  
  // STEP 1: Check cache first
  const cached = await getCachedResults(params);
  if (cached) {
    console.log('[Hotels] Returning cached results');
    return cached;
  }
  
  // STEP 2: Call Amadeus API
  try {
    const token = await getAmadeusToken();
    
    const cityCode = smartConvertToHotelCityCode(params.cityCode || params.destination);
    console.log('[Hotels] Searching city code:', cityCode, 'from input:', params.destination);

    const isProduction = Deno.env.get('AMADEUS_MODE') === 'production';
    const baseUrl = isProduction ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
    const hotelsUrl = `${baseUrl}/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}&radius=50&radiusUnit=KM&hotelSource=ALL`;
    console.log('[Hotels] Step 1 - Fetching hotel list');
    
    const hotelsResponse = await fetch(hotelsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!hotelsResponse.ok) {
      const errorText = await hotelsResponse.text();
      console.error('[Hotels] City search failed:', hotelsResponse.status, errorText);
      return generateFallbackHotels(params, cityCode);
    }

    const hotelsData = await hotelsResponse.json();
    const hotelIds = (hotelsData.data || []).slice(0, 15).map((h: any) => h.hotelId);

    if (hotelIds.length === 0) {
      console.log('[Hotels] No hotels found for city:', cityCode);
      return generateFallbackHotels(params, cityCode);
    }

    console.log('[Hotels] Step 2 - Getting offers for', hotelIds.length, 'hotels');

    const offersParams = new URLSearchParams({
      hotelIds: hotelIds.join(','),
      checkInDate: params.checkIn,
      checkOutDate: params.checkOut,
      adults: String(params.guests || 1),
      roomQuantity: String(params.rooms || 1),
      currency: 'USD',
    });

    const offersResponse = await fetch(
      `${baseUrl}/v3/shopping/hotel-offers?${offersParams}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!offersResponse.ok) {
      const errorText = await offersResponse.text();
      console.error('[Hotels] Offers search failed:', offersResponse.status, errorText);
      
      return hotelsData.data.slice(0, 10).map((hotel: any) => 
        normalizeHotelData(hotel, null, params)
      );
    }

    const offersData = await offersResponse.json();
    console.log('[Hotels] Got offers for', offersData.data?.length || 0, 'hotels');

    // Sandbox fix for empty results
    if (!offersData.data?.length) {
      const originalNights = Math.max(
        1,
        Math.ceil(
          (new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
      const originalAdults = params.guests || 1;

      console.log('[Hotels] ⚠️ Empty results - retrying with relaxed params');

      const toISODate = (d: Date) => d.toISOString().split('T')[0];
      const relaxedCheckOut = (() => {
        const d = new Date(params.checkIn);
        d.setDate(d.getDate() + 1);
        return toISODate(d);
      })();

      const relaxedOffersParams = new URLSearchParams({
        hotelIds: hotelIds.slice(0, 10).join(','),
        checkInDate: params.checkIn,
        checkOutDate: relaxedCheckOut,
        adults: '1',
        roomQuantity: '1',
        currency: 'USD',
      });

      const relaxedResp = await fetch(
        `${baseUrl}/v3/shopping/hotel-offers?${relaxedOffersParams}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (relaxedResp.ok) {
        const relaxedData = await relaxedResp.json();
        const relaxedCount = relaxedData.data?.length || 0;
        console.log('[Hotels] ✅ Relaxed retry returned', relaxedCount, 'offers');

        if (relaxedCount > 0) {
          const nightsMultiplier = originalNights;
          const guestsMultiplier = Math.sqrt(originalAdults);

          const relaxedParams: HotelSearchParams = {
            ...params,
            guests: 1,
            checkOut: relaxedCheckOut,
          };

          const results = (relaxedData.data || []).map((hotelOffer: any) => {
            const normalized = normalizeHotelData(hotelOffer, hotelOffer.offers?.[0], relaxedParams);
            const basePrice = Number(normalized.pricePerNight) || 150;
            const scaledPricePerNight = Math.round(basePrice * guestsMultiplier);
            const scaledTotalPrice = Math.round(scaledPricePerNight * originalNights);

            return {
              ...normalized,
              checkIn: params.checkIn,
              checkOut: params.checkOut,
              nights: originalNights,
              pricePerNight: scaledPricePerNight,
              totalPrice: scaledTotalPrice,
              source: 'amadeus',
              _priceScaled: true,
            };
          });
          
          // Cache the results
          await cacheResults(params, results);
          return results;
        }
      }

      console.log('[Hotels] Falling back to Step 1 hotel list');
      return hotelsData.data.slice(0, 10).map((hotel: any) => normalizeHotelData(hotel, null, params));
    }

    // Transform with full normalization
    const results = (offersData.data || []).map((hotelOffer: any) => 
      normalizeHotelData(hotelOffer, hotelOffer.offers?.[0], params)
    );
    
    // STEP 3: Cache results
    await cacheResults(params, results);
    
    return results;

  } catch (error) {
    console.error('[Hotels] Search error:', error);
    return generateFallbackHotels(params, params.destination);
  }
}

// Generate fallback hotels when API fails
function generateFallbackHotels(params: HotelSearchParams, destination: string): any[] {
  console.log('[Hotels] Generating fallback hotels for', destination);
  
  const hotelNames = [
    'Grand Hotel', 'City Center Inn', 'Harbor View Hotel', 
    'Plaza Hotel', 'Park Avenue Suites', 'Metropolitan Hotel',
    'Riverside Lodge', 'Downtown Boutique', 'Executive Suites',
    'Comfort Stay'
  ];
  
  const checkIn = new Date(params.checkIn);
  const checkOut = new Date(params.checkOut);
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  
  return hotelNames.slice(0, 8).map((name, index) => ({
    id: `fallback-hotel-${index + 1}`,
    hotelId: `fallback-${index + 1}`,
    name: `${name} ${destination}`,
    address: `${100 + index * 10} Main Street, ${destination}`,
    city: destination,
    location: destination,
    neighborhood: 'City Center',
    rating: 3 + (index % 3),
    starRating: 3 + (index % 3),
    stars: 3 + (index % 3),
    pricePerNight: 120 + (index * 25),
    totalPrice: (120 + (index * 25)) * nights,
    price: (120 + (index * 25)) * nights,
    currency: 'USD',
    roomType: ['Standard Room', 'Deluxe Room', 'Suite'][index % 3],
    bedType: 1,
    description: `A comfortable stay in the heart of ${destination}`,
    imageUrl: null,
    photos: [],
    images: [],
    amenities: ['WiFi', 'Air Conditioning', 'TV'],
    cancellationPolicy: 'Free cancellation up to 24 hours before check-in',
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    nights,
    latitude: null,
    longitude: null,
    reviewScore: 8.0 + (index % 2),
    reviewCount: 50 + index * 20,
    website: null,
    googleMapsUrl: null,
    placeId: null,
    source: 'fallback',
  }));
}

// ============= HOTEL ENRICHMENT =============
async function enrichHotel(hotelId: string): Promise<any> {
  console.log('[Hotels] Enriching hotel:', hotelId);
  // Placeholder for Google Places enrichment
  return { hotelId, enriched: false, message: 'Enrichment not yet implemented' };
}

// ============= HTTP HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[Hotels] Request:', JSON.stringify(body));

    if (body.action === 'enrich') {
      const result = await enrichHotel(body.hotelId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: search
    const hotels = await searchHotels(body);
    
    return new Response(JSON.stringify({
      success: true,
      hotels,
      count: hotels.length,
      source: hotels[0]?.source || 'unknown',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Hotels] Handler error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(JSON.stringify({ 
      error: message,
      hotels: [],
      success: false,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
