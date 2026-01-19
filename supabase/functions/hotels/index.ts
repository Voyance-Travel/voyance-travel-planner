import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
}

// ============= TOKEN MANAGEMENT =============
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAmadeusToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    console.log('[Hotels] Using cached token');
    return cachedToken.token;
  }

  // Unified credential handling
  const apiKey = Deno.env.get('AMADEUS_API_KEY') || Deno.env.get('AMADEUS_CLIENT_ID') || '';
  const apiSecret = Deno.env.get('AMADEUS_API_SECRET') || Deno.env.get('AMADEUS_CLIENT_SECRET') || '';

  if (!apiKey || !apiSecret) {
    console.error('[Hotels] Missing credentials');
    throw new Error('Amadeus credentials not configured');
  }

  console.log('[Hotels] Fetching new Amadeus access token (TEST MODE)');
  
  const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
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
// CRITICAL: Amadeus Hotel API requires CITY codes, not airport codes
const airportToCityCode: Record<string, string> = {
  // Paris airports
  'CDG': 'PAR', 'ORY': 'PAR',
  // London airports
  'LHR': 'LON', 'LGW': 'LON', 'STN': 'LON', 'LTN': 'LON', 'LCY': 'LON',
  // New York airports
  'JFK': 'NYC', 'LGA': 'NYC', 'EWR': 'NYC',
  // Los Angeles airports
  'LAX': 'LAX',
  // Chicago airports
  'ORD': 'CHI', 'MDW': 'CHI',
  // Tokyo airports
  'NRT': 'TYO', 'HND': 'TYO',
  // Sydney airports
  'SYD': 'SYD',
  // Rome airports
  'FCO': 'ROM', 'CIA': 'ROM',
  // Milan airports
  'MXP': 'MIL', 'LIN': 'MIL',
  // Barcelona
  'BCN': 'BCN',
  // Madrid
  'MAD': 'MAD',
  // Lisbon
  'LIS': 'LIS',
  // Amsterdam
  'AMS': 'AMS',
  // Berlin
  'BER': 'BER', 'TXL': 'BER', 'SXF': 'BER',
  // Dubai
  'DXB': 'DXB', 'DWC': 'DXB',
  // Singapore
  'SIN': 'SIN',
  // Hong Kong
  'HKG': 'HKG',
  // Bangkok
  'BKK': 'BKK', 'DMK': 'BKK',
  // Seoul
  'ICN': 'SEL', 'GMP': 'SEL',
  // Miami
  'MIA': 'MIA',
  // San Francisco
  'SFO': 'SFO', 'OAK': 'SFO', 'SJC': 'SFO',
  // Atlanta
  'ATL': 'ATL',
  // Istanbul
  'IST': 'IST', 'SAW': 'IST',
  // Dublin
  'DUB': 'DUB',
  // Vienna
  'VIE': 'VIE',
  // Prague
  'PRG': 'PRG',
  // Copenhagen
  'CPH': 'CPH',
  // Stockholm
  'ARN': 'STO',
  // Helsinki
  'HEL': 'HEL',
  // Munich
  'MUC': 'MUC',
  // Frankfurt
  'FRA': 'FRA',
  // Zurich
  'ZRH': 'ZRH',
  // Brussels
  'BRU': 'BRU',
  // Athens
  'ATH': 'ATH',
  // Cairo
  'CAI': 'CAI',
  // Mumbai
  'BOM': 'BOM',
  // Delhi
  'DEL': 'DEL',
  // Beijing
  'PEK': 'BJS', 'PKX': 'BJS',
  // Shanghai
  'PVG': 'SHA', 'SHA': 'SHA',
};

// City name to city code mapping
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
  
  // 1. Check if it's an airport code that needs conversion
  if (airportToCityCode[normalized]) {
    console.log(`[Hotels] Converting airport ${normalized} to city ${airportToCityCode[normalized]}`);
    return airportToCityCode[normalized];
  }
  
  // 2. Check if it's already a valid city code (3 letters)
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }
  
  // 3. Try to extract city code from destination string like "Lisbon (LIS)"
  const codeMatch = input.match(/\(([A-Z]{3})\)/);
  if (codeMatch) {
    const extracted = codeMatch[1];
    return airportToCityCode[extracted] || extracted;
  }
  
  // 4. Try city name lookup
  const lowerInput = input.toLowerCase().trim();
  for (const [cityName, cityCode] of Object.entries(cityNameToCode)) {
    if (lowerInput.includes(cityName)) {
      console.log(`[Hotels] Found city name ${cityName} -> ${cityCode}`);
      return cityCode;
    }
  }
  
  // 5. Last resort - use first 3 letters
  console.log(`[Hotels] Warning: Using fallback for ${input}`);
  return normalized.substring(0, 3);
}

// ============= FIELD NORMALIZATION =============
// Ensure all required frontend fields exist with sensible defaults
function normalizeHotelData(hotel: any, offer: any, params: HotelSearchParams): any {
  const checkIn = new Date(params.checkIn);
  const checkOut = new Date(params.checkOut);
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  
  const totalPrice = parseFloat(offer?.price?.total || '0');
  const pricePerNight = totalPrice > 0 ? totalPrice / nights : 150; // Default $150/night
  
  const hotelData = hotel.hotel || hotel;
  
  // Build photos array from various sources
  const photos: string[] = [];
  if (hotelData.media?.length) {
    photos.push(...hotelData.media.map((m: any) => m.uri).filter(Boolean));
  }
  
  return {
    // Core identification
    id: hotelData.hotelId || hotelData.id || `hotel-${Date.now()}`,
    hotelId: hotelData.hotelId || hotelData.id,
    
    // Name & location (with defaults)
    name: hotelData.name || 'Hotel',
    address: hotelData.address?.lines?.join(', ') || hotelData.address?.line1 || '',
    city: hotelData.address?.cityName || params.destination,
    location: hotelData.address?.cityName || params.destination,
    neighborhood: hotelData.address?.cityName || 'City Center',
    
    // Rating (normalize to 1-5 scale)
    rating: normalizeRating(hotelData.rating),
    starRating: normalizeRating(hotelData.rating),
    stars: normalizeRating(hotelData.rating),
    
    // Pricing
    pricePerNight: Math.round(pricePerNight),
    totalPrice: totalPrice > 0 ? totalPrice : pricePerNight * nights,
    price: totalPrice > 0 ? totalPrice : pricePerNight * nights,
    currency: offer?.price?.currency || 'USD',
    
    // Room info (with defaults)
    roomType: offer?.room?.typeEstimated?.category || 'Standard Room',
    bedType: offer?.room?.typeEstimated?.beds || 1,
    description: offer?.room?.description?.text || `Comfortable room in ${hotelData.name || 'the hotel'}`,
    
    // Images - now properly structured for frontend
    imageUrl: photos[0] || null,
    photos: photos,
    images: photos, // Alias for frontend compatibility
    
    // Amenities (ensure array)
    amenities: Array.isArray(hotelData.amenities) ? hotelData.amenities : [],
    
    // Policies
    cancellationPolicy: offer?.policies?.cancellation?.description?.text || 'See hotel policy for details',
    
    // Dates
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    nights,
    
    // Coordinates
    latitude: hotelData.geoCode?.latitude || hotelData.latitude,
    longitude: hotelData.geoCode?.longitude || hotelData.longitude,
    
    // Reviews (provide defaults if missing)
    reviewScore: hotelData.rating ? hotelData.rating * 2 : 8.0,
    reviewCount: 0,
    
    // Website & Google Places enrichment placeholders
    website: null,
    googleMapsUrl: null,
    placeId: null,
    
    // Source
    source: 'amadeus',
  };
}

function normalizeRating(rating: any): number {
  if (!rating) return 3;
  const num = typeof rating === 'string' ? parseInt(rating, 10) : rating;
  return Math.min(5, Math.max(1, num || 3));
}

// ============= SEARCH HOTELS =============
async function searchHotels(params: HotelSearchParams): Promise<any[]> {
  console.log('[Hotels] Search params:', JSON.stringify(params));
  
  try {
    const token = await getAmadeusToken();
    
    // CRITICAL: Convert airport code to city code
    const cityCode = smartConvertToHotelCityCode(params.cityCode || params.destination);
    console.log('[Hotels] Searching city code:', cityCode, 'from input:', params.destination);

    // Step 1: Get hotels by city
    const hotelsUrl = `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}&radius=50&radiusUnit=KM&hotelSource=ALL`;
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

    // Step 2: Get offers
    const offersParams = new URLSearchParams({
      hotelIds: hotelIds.join(','),
      checkInDate: params.checkIn,
      checkOutDate: params.checkOut,
      adults: String(params.guests || 1),
      roomQuantity: String(params.rooms || 1),
      currency: 'USD',
    });

    const offersResponse = await fetch(
      `https://test.api.amadeus.com/v3/shopping/hotel-offers?${offersParams}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!offersResponse.ok) {
      const errorText = await offersResponse.text();
      console.error('[Hotels] Offers search failed:', offersResponse.status, errorText);
      
      // Return basic info without pricing
      return hotelsData.data.slice(0, 10).map((hotel: any) => 
        normalizeHotelData(hotel, null, params)
      );
    }

    const offersData = await offersResponse.json();
    console.log('[Hotels] Got offers for', offersData.data?.length || 0, 'hotels');

    // ============= AMADEUS SANDBOX FIX =============
    // If Amadeus returns empty offers, it's usually because the sandbox has limited availability
    // for the exact occupancy/date range. We'll retry with relaxed params to confirm offers exist.
    if (!offersData.data?.length) {
      const originalNights = Math.max(
        1,
        Math.ceil(
          (new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
      const originalAdults = params.guests || 1;

      console.log('[Hotels] ⚠️ Empty results detected - retrying with relaxed params', {
        originalParams: { nights: originalNights, adults: originalAdults },
      });

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
        `https://test.api.amadeus.com/v3/shopping/hotel-offers?${relaxedOffersParams}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (relaxedResp.ok) {
        const relaxedData = await relaxedResp.json();
        const relaxedCount = relaxedData.data?.length || 0;
        console.log('[Hotels] ✅ Relaxed retry returned', relaxedCount, 'offers');

        if (relaxedCount > 0) {
          // PRICE SCALING FORMULA:
          // - Nights: Linear scaling (7 nights = 7× price)
          // - Guests: Square root scaling (3 guests ≈ 1.73× price)
          //   Why sqrt? Additional guests share rooms/resources, not full linear cost
          const nightsMultiplier = originalNights; // simplified was 1 night
          const guestsMultiplier = Math.sqrt(originalAdults); // sqrt scaling for guests

          console.log('[Hotels] Price scaling multipliers:', {
            nightsMultiplier,
            guestsMultiplier: guestsMultiplier.toFixed(2),
            totalMultiplier: (nightsMultiplier * guestsMultiplier).toFixed(2),
          });

          const relaxedParams: HotelSearchParams = {
            ...params,
            guests: 1,
            checkOut: relaxedCheckOut,
          };

          return (relaxedData.data || []).map((hotelOffer: any) => {
            const normalized = normalizeHotelData(hotelOffer, hotelOffer.offers?.[0], relaxedParams);
            const basePrice = Number(normalized.pricePerNight) || 150;

            // Scale the price: base × nights × sqrt(guests)
            const scaledPricePerNight = Math.round(basePrice * guestsMultiplier);
            const scaledTotalPrice = Math.round(scaledPricePerNight * originalNights);

            console.log('[Hotels] Scaled price:', {
              hotelId: normalized.id,
              basePrice,
              scaledPricePerNight,
              scaledTotalPrice,
            });

            return {
              ...normalized,
              checkIn: params.checkIn,
              checkOut: params.checkOut,
              nights: originalNights,
              pricePerNight: scaledPricePerNight,
              totalPrice: scaledTotalPrice,
              source: 'amadeus',
              _priceScaled: true, // Flag for debugging/QA
            };
          });
        }
      } else {
        const errorText = await relaxedResp.text();
        console.error('[Hotels] Relaxed offers retry failed:', relaxedResp.status, errorText);
      }

      // Final fallback: use Step 1 hotel names without offer pricing
      console.log('[Hotels] Falling back to Step 1 hotel list (no offers available in sandbox)');
      return hotelsData.data.slice(0, 10).map((hotel: any) => normalizeHotelData(hotel, null, params));
    }

    // Transform with full normalization
    return (offersData.data || []).map((hotelOffer: any) => 
      normalizeHotelData(hotelOffer, hotelOffer.offers?.[0], params)
    );

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
    reviewScore: 7.5 + (index * 0.2),
    reviewCount: 50 + (index * 20),
    website: null,
    googleMapsUrl: null,
    placeId: null,
    source: 'fallback',
  }));
}

// =============================================================================
// GOOGLE PLACES HOTEL ENRICHMENT
// =============================================================================
async function enrichHotelWithPlaces(
  hotelName: string,
  destination: string,
  apiKey: string
): Promise<{ address?: string; website?: string; googleMapsUrl?: string; photos?: string[]; placeId?: string } | null> {
  try {
    const textQuery = `${hotelName} hotel ${destination}`;
    console.log('[Hotels] Enriching hotel via Google Places:', textQuery);

    const searchResponse = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.photos",
        },
        body: JSON.stringify({
          textQuery,
          maxResultCount: 1,
        }),
      }
    );

    if (!searchResponse.ok) {
      console.error('[Hotels] Google Places enrichment failed:', searchResponse.status);
      return null;
    }

    const searchData = await searchResponse.json();
    const place = searchData.places?.[0];

    if (!place) {
      console.log('[Hotels] No Google Places result for:', textQuery);
      return null;
    }

    // Get photo URLs if available
    const photos: string[] = [];
    if (place.photos?.length && apiKey) {
      for (const photo of place.photos.slice(0, 5)) {
        const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${apiKey}`;
        photos.push(photoUrl);
      }
    }

    console.log('[Hotels] ✅ Enriched hotel:', place.displayName?.text, '- got', photos.length, 'photos');

    return {
      address: place.formattedAddress || undefined,
      website: place.websiteUri || undefined,
      googleMapsUrl: place.googleMapsUri || undefined,
      photos: photos.length > 0 ? photos : undefined,
      placeId: place.id || undefined,
    };
  } catch (error) {
    console.error('[Hotels] Google Places enrichment error:', error);
    return null;
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
      console.log('[Hotels] Request:', JSON.stringify(body));
      
      // Check if this is an enrichment request
      if (body.action === 'enrich' && body.hotelName) {
        const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
        if (!apiKey) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Google Maps API key not configured' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const enrichment = await enrichHotelWithPlaces(
          body.hotelName,
          body.destination || '',
          apiKey
        );
        
        return new Response(JSON.stringify({ 
          success: !!enrichment,
          enrichment: enrichment || {},
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Standard hotel search
      const hotels = await searchHotels(body);
      
      return new Response(JSON.stringify({ 
        hotels,
        success: true,
        count: hotels.length,
        source: hotels[0]?.source || 'amadeus_test',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Hotels] Handler error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    // ALWAYS return valid JSON with empty array - never crash frontend
    return new Response(JSON.stringify({ 
      error: message,
      hotels: [],
      success: false,
    }), {
      status: 200, // Return 200 with error for graceful handling
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
