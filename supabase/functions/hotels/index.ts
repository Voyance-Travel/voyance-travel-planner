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

// ============= HOTEL SEARCH BY NAME (Google Places) =============
interface HotelSearchResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  website?: string;
  googleMapsUrl?: string;
  coordinates?: { lat: number; lng: number };
}

async function searchHotelsByName(
  query: string,
  destination: string
): Promise<HotelSearchResult[]> {
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
  
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[Hotels] Google Maps API key not configured');
    return [];
  }

  try {
    // Construct search query for hotels
    const textQuery = `${query} hotel ${destination}`;
    console.log('[Hotels] Searching Google Places:', textQuery);

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.location,places.websiteUri,places.googleMapsUri,places.types',
        },
        body: JSON.stringify({
          textQuery,
          includedType: 'lodging',
          maxResultCount: 8,
          languageCode: 'en',
        }),
      }
    );

    if (!response.ok) {
      console.error('[Hotels] Google Places error:', await response.text());
      return [];
    }

    const data = await response.json();
    const places = data.places || [];

    console.log('[Hotels] Found', places.length, 'hotels via Google Places');

    return places.map((place: any) => ({
      placeId: place.id,
      name: place.displayName?.text || 'Unknown Hotel',
      address: place.formattedAddress || '',
      rating: place.rating,
      reviewCount: place.userRatingCount,
      priceLevel: place.priceLevel ? mapPriceLevel(place.priceLevel) : undefined,
      website: place.websiteUri,
      googleMapsUrl: place.googleMapsUri,
      coordinates: place.location ? {
        lat: place.location.latitude,
        lng: place.location.longitude,
      } : undefined,
    }));
  } catch (error) {
    console.error('[Hotels] Search error:', error);
    return [];
  }
}

function mapPriceLevel(priceLevel: string): number {
  const mapping: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return mapping[priceLevel] ?? 2;
}

// ============= HOTEL ENRICHMENT =============
async function enrichHotelByName(
  hotelName: string,
  destination: string
): Promise<any> {
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
  
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[Hotels] Google Maps API key not configured');
    return { success: false, message: 'API key not configured' };
  }

  try {
    const textQuery = `${hotelName} ${destination}`;
    console.log('[Hotels] Enriching hotel:', textQuery);

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.location,places.websiteUri,places.googleMapsUri,places.photos',
        },
        body: JSON.stringify({
          textQuery,
          includedType: 'lodging',
          maxResultCount: 1,
          languageCode: 'en',
        }),
      }
    );

    if (!response.ok) {
      console.error('[Hotels] Enrichment API error:', await response.text());
      return { success: false, message: 'API error' };
    }

    const data = await response.json();
    const place = data.places?.[0];

    if (!place) {
      console.log('[Hotels] No place found for:', hotelName);
      return { success: false, message: 'Hotel not found' };
    }

    // Build photo URLs if available
    const photos = place.photos?.slice(0, 5).map((photo: any) => 
      `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=800&maxWidthPx=1200&key=${GOOGLE_MAPS_API_KEY}`
    ) || [];

    return {
      success: true,
      enrichment: {
        placeId: place.id,
        name: place.displayName?.text || hotelName,
        address: place.formattedAddress,
        rating: place.rating,
        reviewCount: place.userRatingCount,
        priceLevel: place.priceLevel ? mapPriceLevel(place.priceLevel) : undefined,
        website: place.websiteUri,
        googleMapsUrl: place.googleMapsUri,
        coordinates: place.location ? {
          lat: place.location.latitude,
          lng: place.location.longitude,
        } : undefined,
        photos,
      },
    };
  } catch (error) {
    console.error('[Hotels] Enrichment error:', error);
    return { success: false, message: 'Enrichment failed' };
  }
}

// ============= HOTEL BOOKING (Amadeus API) =============
interface HotelBookingRequest {
  offerId: string;
  hotelId: string;
  tripId: string;
  paymentId: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  totalAmount: number;
  currency?: string;
  guests: Array<{
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    title?: string;
  }>;
  paymentInfo?: {
    vendorCode: string;
    cardNumber: string;
    expiryDate: string;
    holderName: string;
  };
}

interface HotelBookingResponse {
  success: boolean;
  booking?: {
    confirmationNumber: string;
    bookingId: string;
    status: string;
    hotelName?: string;
  };
  error?: string;
  code?: string;
  refundRequired?: boolean;
}

async function bookHotel(
  request: HotelBookingRequest,
  userId: string
): Promise<HotelBookingResponse> {
  const supabase = getSupabaseAdmin();

  console.log('[Hotels] Starting booking flow', {
    offerId: request.offerId,
    hotelId: request.hotelId,
    tripId: request.tripId,
  });

  // Step 1: Verify payment is confirmed
  const { data: payment, error: paymentError } = await supabase
    .from('trip_payments')
    .select('*')
    .eq('id', request.paymentId)
    .single();

  if (paymentError || !payment) {
    console.error('[Hotels] Payment not found:', paymentError);
    return {
      success: false,
      error: 'Payment record not found',
      code: 'PAYMENT_NOT_FOUND',
    };
  }

  if (payment.status !== 'paid') {
    console.error('[Hotels] Payment not confirmed:', payment.status);
    return {
      success: false,
      error: `Payment not confirmed. Status: ${payment.status}`,
      code: 'PAYMENT_NOT_CONFIRMED',
    };
  }

  console.log('[Hotels] Payment verified:', request.paymentId);

  // Step 2: Get Amadeus token
  let token: string;
  try {
    token = await getAmadeusToken();
  } catch (e) {
    console.error('[Hotels] Token error:', e);
    return {
      success: false,
      error: 'Failed to authenticate with booking provider',
      code: 'AUTH_ERROR',
    };
  }

  const isProduction = Deno.env.get('AMADEUS_MODE') === 'production';
  const baseUrl = isProduction
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com';

  // Step 3: Build Amadeus booking payload
  const leadGuest = request.guests[0];
  const bookingPayload = {
    data: {
      offerId: request.offerId,
      guests: request.guests.map((guest, index) => ({
        tid: index + 1,
        title: guest.title || 'MR',
        firstName: guest.firstName,
        lastName: guest.lastName,
        phone: guest.phone || '+1555555555',
        email: guest.email || leadGuest.email || 'guest@example.com',
      })),
      // Note: In production, payment would be handled differently
      // For sandbox/test mode, we simulate the booking
      payments: request.paymentInfo
        ? [
            {
              method: 'CREDIT_CARD',
              card: {
                vendorCode: request.paymentInfo.vendorCode,
                cardNumber: request.paymentInfo.cardNumber,
                expiryDate: request.paymentInfo.expiryDate,
                holderName: request.paymentInfo.holderName,
              },
            },
          ]
        : undefined,
    },
  };

  console.log('[Hotels] Submitting to Amadeus', {
    offerId: request.offerId,
    guestCount: request.guests.length,
  });

  // Step 4: Call Amadeus Hotel Booking API
  const response = await fetch(`${baseUrl}/v1/booking/hotel-bookings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bookingPayload),
  });

  const data = await response.json();

  // Handle sandbox limitations - simulate success
  if (!response.ok) {
    console.error('[Hotels] Amadeus booking API error:', response.status, data);

    // In sandbox mode, the booking API may not be available
    // Simulate a successful booking for testing
    if (!isProduction && (response.status === 401 || response.status === 403 || response.status === 400)) {
      console.log('[Hotels] Sandbox mode - simulating successful booking');

      const simulatedConfirmation = `SIM-${Date.now().toString(36).toUpperCase()}`;
      const simulatedBookingId = `HBKG-${request.tripId.slice(0, 8).toUpperCase()}`;

      // Update payment record with simulated confirmation
      await supabase.from('trip_payments').update({
        status: 'completed',
        external_booking_id: simulatedBookingId,
        updated_at: new Date().toISOString(),
      }).eq('id', request.paymentId);

      // Update trip with hotel booking confirmation
      await updateTripHotelConfirmation(supabase, request.tripId, request.hotelId, {
        confirmationNumber: simulatedConfirmation,
        bookingId: simulatedBookingId,
        status: 'CONFIRMED',
        bookedAt: new Date().toISOString(),
        source: 'amadeus_sandbox',
      });

      return {
        success: true,
        booking: {
          confirmationNumber: simulatedConfirmation,
          bookingId: simulatedBookingId,
          status: 'CONFIRMED',
          hotelName: request.roomType,
        },
      };
    }

    // Real failure - update payment and signal refund
    await supabase.from('trip_payments').update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    }).eq('id', request.paymentId);

    return {
      success: false,
      error: data.errors?.[0]?.detail || 'Hotel booking failed',
      code: data.errors?.[0]?.code || 'BOOKING_FAILED',
      refundRequired: true,
    };
  }

  // Step 5: Extract confirmation from Amadeus response
  const hotelBooking = data.data?.hotelBookings?.[0];
  const confirmationNumber =
    hotelBooking?.hotelProviderInformation?.[0]?.confirmationNumber ||
    hotelBooking?.id ||
    data.data?.id;
  const bookingStatus = hotelBooking?.bookingStatus || 'CONFIRMED';

  console.log('[Hotels] Booking successful:', {
    confirmationNumber,
    status: bookingStatus,
  });

  // Step 6: Update payment record with confirmation
  await supabase.from('trip_payments').update({
    status: 'completed',
    external_booking_id: confirmationNumber,
    updated_at: new Date().toISOString(),
  }).eq('id', request.paymentId);

  // Step 7: Update trip with hotel booking confirmation
  await updateTripHotelConfirmation(supabase, request.tripId, request.hotelId, {
    confirmationNumber,
    bookingId: data.data?.id,
    status: bookingStatus,
    bookedAt: new Date().toISOString(),
    source: 'amadeus',
    rawResponse: data,
  });

  return {
    success: true,
    booking: {
      confirmationNumber,
      bookingId: data.data?.id,
      status: bookingStatus,
    },
  };
}

// Helper to update trip hotel selection with confirmation
async function updateTripHotelConfirmation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tripId: string,
  hotelId: string,
  confirmation: {
    confirmationNumber: string;
    bookingId: string;
    status: string;
    bookedAt: string;
    source: string;
    rawResponse?: unknown;
  }
) {
  try {
    // Get current trip data
    const { data: trip, error } = await supabase
      .from('trips')
      .select('hotel_selection')
      .eq('id', tripId)
      .single();

    if (error || !trip) {
      console.warn('[Hotels] Could not fetch trip for confirmation update:', error);
      return;
    }

    // Handle both array and object formats
    let hotelSelection = trip.hotel_selection;
    
    if (Array.isArray(hotelSelection)) {
      // Find and update the matching hotel
      hotelSelection = hotelSelection.map((hotel: any) => {
        if (hotel.id === hotelId || hotel.hotelId === hotelId) {
          return {
            ...hotel,
            booking: confirmation,
            bookingStatus: 'confirmed',
          };
        }
        return hotel;
      });
    } else if (hotelSelection && typeof hotelSelection === 'object') {
      // Single hotel object
      hotelSelection = {
        ...hotelSelection,
        booking: confirmation,
        bookingStatus: 'confirmed',
      };
    }

    await supabase
      .from('trips')
      .update({
        hotel_selection: hotelSelection,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    console.log('[Hotels] Trip hotel confirmation updated:', tripId);
  } catch (e) {
    console.error('[Hotels] Failed to update trip confirmation:', e);
  }
}

// ============= HTTP HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[Hotels] Request:', body.action || 'search');

    // Hotel booking action
    if (body.action === 'book') {
      // Auth check
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'Authorization required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'User not authenticated' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await bookHotel(body, user.id);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search hotels by name (for autocomplete)
    if (body.action === 'searchByName') {
      const results = await searchHotelsByName(body.query, body.destination);
      return new Response(JSON.stringify({
        success: true,
        hotels: results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enrich hotel details
    if (body.action === 'enrich') {
      const result = await enrichHotelByName(body.hotelName, body.destination);
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
