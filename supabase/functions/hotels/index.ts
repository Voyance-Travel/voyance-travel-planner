import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { getCachedPlacesPhotoByResource } from "../_shared/photo-storage.ts";
import { trackCost } from "../_shared/cost-tracker.ts";
import { googlePlacesTextSearch } from "../_shared/google-api.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  tripId?: string;
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

// ============= PRICE ESTIMATION FROM GOOGLE PRICE LEVEL =============
function estimateNightlyPrice(priceLevel: number | undefined, starRating: number): number {
  // Google price_level: 0=Free, 1=Inexpensive, 2=Moderate, 3=Expensive, 4=Very Expensive
  const basePrices: Record<number, number> = {
    0: 80,
    1: 120,
    2: 200,
    3: 350,
    4: 550,
  };
  let price = basePrices[priceLevel ?? 2] || 200;

  // Adjust by star rating
  if (starRating >= 5) price *= 1.4;
  else if (starRating >= 4) price *= 1.15;
  else if (starRating <= 2) price *= 0.7;

  return clampPrice(Math.round(price), `star-${starRating}`);
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
  'AUS': 'AUS', 'DFW': 'DFW', 'IAH': 'HOU', 'HOU': 'HOU',
  'SEA': 'SEA', 'BOS': 'BOS', 'DEN': 'DEN', 'PHX': 'PHX',
  'MSP': 'MSP', 'DTW': 'DTW', 'CLT': 'CLT', 'MCO': 'MCO',
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
  'austin': 'AUS', 'dallas': 'DFW', 'houston': 'HOU', 'seattle': 'SEA',
  'boston': 'BOS', 'denver': 'DEN', 'phoenix': 'PHX', 'minneapolis': 'MSP',
  'detroit': 'DTW', 'charlotte': 'CLT', 'orlando': 'MCO',
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

// ============= PRICE CLAMPING =============
function clampPrice(pricePerNight: number, hotelName: string): number {
  const MIN_PRICE = 50;
  const MAX_PRICE = 2000;

  if (pricePerNight < MIN_PRICE) {
    console.warn(`[Hotels] Price too low for ${hotelName}: $${pricePerNight} → $${MIN_PRICE}`);
    return MIN_PRICE;
  }
  if (pricePerNight > MAX_PRICE) {
    console.warn(`[Hotels] Price too high for ${hotelName}: $${pricePerNight} → $${MAX_PRICE}`);
    return MAX_PRICE;
  }
  return Math.round(pricePerNight);
}

// ============= STAR RATING FROM BRAND + GOOGLE DATA =============
function deriveStarRating(
  googleRating: number | undefined,
  priceLevel: number | undefined,
  hotelName: string,
  currentRating: number
): number {
  const nameLower = hotelName.toLowerCase();

  // Budget brands: 2 stars
  if (/motel 6|super 8|red roof|econo|days inn/i.test(nameLower)) return 2;
  // Economy brands: 3 stars
  if (/hampton|holiday inn express|la quinta|best western|comfort inn|fairfield/i.test(nameLower)) return 3;
  // Mid-tier brands: 3 stars
  if (/courtyard|hilton garden|homewood|residence inn|springhill|hyatt place|aloft/i.test(nameLower)) return 3;
  // Upper mid-tier: 4 stars
  if (/marriott(?! vacation)|hilton(?! garden)|hyatt(?! place)|sheraton|westin|embassy|doubletree/i.test(nameLower)) return 4;
  // Luxury brands: 5 stars
  if (/ritz|four seasons|st\. regis|waldorf|mandarin|peninsula|w hotel|^w /i.test(nameLower)) return 5;
  // Premium brands: 4 stars
  if (/jw marriott|omni|fairmont|intercontinental|sofitel|kimpton/i.test(nameLower)) return 4;

  // Fallback: use price_level (Google 0-4 → 1-5 stars)
  if (priceLevel !== undefined && priceLevel >= 0) {
    return Math.min(5, Math.max(1, priceLevel + 1));
  }
  // Last resort: floor Google review rating (4.6 → 4, not 5)
  if (googleRating && googleRating > 0) {
    return Math.min(5, Math.max(1, Math.floor(googleRating)));
  }
  return currentRating;
}

// ============= NEIGHBORHOOD EXTRACTION =============
function extractNeighborhood(
  googleData: any,
  hotelName: string,
  fallbackCity: string
): string {
  // 1. Try Google's address_components for sublocality/neighborhood
  if (googleData?.addressComponents) {
    for (const comp of googleData.addressComponents) {
      if (comp.types?.includes('sublocality') ||
          comp.types?.includes('neighborhood') ||
          comp.types?.includes('sublocality_level_1')) {
        return comp.longText || comp.shortText;
      }
    }
  }

  // 2. Match against known neighborhoods by street/address keywords
  const address = (googleData?.formattedAddress || '').toLowerCase();
  const name = hotelName.toLowerCase();

  const neighborhoodMap: Record<string, string[]> = {
    'Downtown': ['congress ave', 'colorado st', 'lavaca st', 'san jacinto', 'brazos st', '6th st', '6th street', 'e 6th', 'w 6th', 'cesar chavez', 'convention center', 'downtown'],
    'South Congress (SoCo)': ['s congress', 'south congress'],
    'East Austin': ['e cesar chavez', 'e 7th', 'e 11th', 'e 12th', 'holly'],
    'Rainey Street': ['rainey'],
    'The Domain': ['domain', 'rock rose'],
    'Mueller': ['mueller', 'barbara jordan'],
    'Hyde Park': ['hyde park', 'guadalupe', 'duval st'],
    'Zilker': ['zilker', 'barton springs'],
    '2nd Street District': ['2nd st', 'second street'],
    'Warehouse District': ['warehouse', 'w 4th', 'w 5th'],
    'Red River Cultural District': ['red river'],
    'Midtown': ['midtown'],
    'Uptown': ['uptown'],
    'French Quarter': ['french quarter', 'bourbon st', 'royal st'],
    'SoHo': ['soho'],
    'Times Square': ['times square', 'broadway'],
  };

  for (const [neighborhood, keywords] of Object.entries(neighborhoodMap)) {
    for (const keyword of keywords) {
      if (address.includes(keyword) || name.includes(keyword)) {
        return neighborhood;
      }
    }
  }

  // 3. Try extracting from formatted_address parts
  if (googleData?.formattedAddress) {
    const parts = googleData.formattedAddress.split(',').map((s: string) => s.trim());
    if (parts.length >= 4) {
      const possibleNeighborhood = parts[1];
      const cityLower = fallbackCity.toLowerCase();
      if (possibleNeighborhood &&
          possibleNeighborhood.toLowerCase() !== cityLower &&
          !possibleNeighborhood.match(/^[A-Z]{2}\s/) &&
          !possibleNeighborhood.match(/^[A-Z]{2}$/) &&
          possibleNeighborhood.length > 1) {
        return possibleNeighborhood;
      }
    }
  }

  return fallbackCity;
}

// ============= DEBUG LOGGING =============
let _firstHotelLogged = false;

// ============= FIELD NORMALIZATION (removed Amadeus-specific normalizeHotelData) =============

// ============= AUTO-ENRICHMENT WITH GOOGLE PLACES =============
async function autoEnrichHotels(results: any[], destination: string): Promise<any[]> {
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!GOOGLE_MAPS_API_KEY || results.length === 0) return results;

  const enrichLimit = Math.min(results.length, 10);
  console.log(`[Hotels] 🔍 Auto-enriching ${enrichLimit} hotels with Google Places`);

  const enrichPromises = results.slice(0, enrichLimit).map(async (hotel: any) => {
    try {
      const enrichResult = await enrichHotelByName(hotel.name, destination);
      if (enrichResult.success && enrichResult.enrichment) {
        const e = enrichResult.enrichment;
        const derivedStars = deriveStarRating(
          e.rating,
          e.priceLevel,
          hotel.name,
          hotel.stars || 3
        );
        return {
          ...hotel,
          // Use brand-derived star rating, NOT raw Google review score
          rating: derivedStars,
          starRating: derivedStars,
          stars: derivedStars,
          // Store Google review data separately
          reviewScore: e.rating ? e.rating * 2 : hotel.reviewScore,
          reviewCount: e.reviewCount || hotel.reviewCount,
          googleReviewScore: e.rating || null,
          googleReviewCount: e.reviewCount || null,
          // Neighborhood from structured Google data
          neighborhood: extractNeighborhood(e, hotel.name, destination),
          address: e.address || hotel.address,
          imageUrl: e.photos?.[0] || hotel.imageUrl,
          photos: e.photos?.length ? e.photos : hotel.photos,
          images: e.photos?.length ? e.photos : hotel.images,
          website: e.website || hotel.website,
          googleMapsUrl: e.googleMapsUrl || hotel.googleMapsUrl,
          placeId: e.placeId || hotel.placeId,
          latitude: e.coordinates?.lat || hotel.latitude,
          longitude: e.coordinates?.lng || hotel.longitude,
          _enriched: true,
        };
      }
      return hotel;
    } catch (err) {
      console.warn(`[Hotels] Enrichment failed for ${hotel.name}:`, err);
      return hotel;
    }
  });

  const enrichedResults = await Promise.all(enrichPromises);

  for (let i = 0; i < enrichedResults.length; i++) {
    results[i] = enrichedResults[i];
  }

  const enrichedCount = enrichedResults.filter((h: any) => h._enriched).length;
  console.log(`[Hotels] ✅ Enrichment complete: ${enrichedCount} of ${enrichLimit} enriched`);
  return results;
}

// ============= RESULTS SUMMARY LOGGING =============
function logResultsSummary(results: any[]): void {
  if (results.length === 0) return;
  console.log('[Hotels] 📊 Final results summary:', JSON.stringify({
    count: results.length,
    enriched: results.filter((h: any) => h._enriched).length,
    withPhotos: results.filter((h: any) => h.imageUrl).length,
    starDistribution: results.reduce((acc: any, h: any) => {
      acc[h.stars] = (acc[h.stars] || 0) + 1;
      return acc;
    }, {}),
    priceRange: {
      min: Math.min(...results.map((h: any) => h.pricePerNight)),
      max: Math.max(...results.map((h: any) => h.pricePerNight)),
    },
  }));
}

// ============= SEARCH HOTELS (with caching) =============
async function searchHotels(params: HotelSearchParams & { skipCache?: boolean }): Promise<any[]> {
  _firstHotelLogged = false; // Reset for each search
  console.log('[Hotels] Search params:', JSON.stringify(params));
  
  // STEP 1: Check cache first (unless skipCache is set)
  if (!params.skipCache) {
    const cached = await getCachedResults(params);
    if (cached) {
      console.log('[Hotels] Returning cached results');
      return cached;
    }
  } else {
    console.log('[Hotels] ⏭️ Skipping cache (skipCache=true)');
  }
  
  // STEP 2: Search via Google Places Text Search (replaces Amadeus)
  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('[Hotels] Google Maps API key not configured');
      return generateFallbackHotels(params, params.destination);
    }

    const cityName = (params.destination || '').replace(/\s*\([A-Z]{3}\)\s*/g, '').trim();
    console.log('[Hotels] 🔍 Searching Google Places for hotels in:', cityName);

    // Step 2a: Text Search for hotels in the city
    const searchResult = await googlePlacesTextSearch(
      {
        textQuery: `hotels in ${cityName}`,
        includedType: 'lodging',
        maxResultCount: 10,
        languageCode: 'en',
        fieldMask:
          'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.rating,places.userRatingCount,places.priceLevel,places.location,places.websiteUri,places.googleMapsUri,places.photos,places.types',
      },
      { actionType: 'hotels_city_search', reason: `hotels in ${cityName}` },
    );

    if (!searchResult.ok) {
      console.error('[Hotels] Google Places search failed:', searchResult.status, searchResult.errorText);
      return generateFallbackHotels(params, params.destination);
    }

    const places = searchResult.data?.places || [];
    console.log('[Hotels] Found', places.length, 'hotels via Google Places');

    if (places.length === 0) {
      return generateFallbackHotels(params, params.destination);
    }

    const checkIn = new Date(params.checkIn);
    const checkOut = new Date(params.checkOut);
    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

    // Step 2b: Build hotel objects from Google Places data + fetch photos
    const results = await Promise.all(
      places.slice(0, 8).map(async (place: any, index: number) => {
        const hotelName = place.displayName?.text || 'Unknown Hotel';
        const priceLevel = place.priceLevel ? mapPriceLevel(place.priceLevel) : undefined;
        const starRating = deriveStarRating(place.rating, priceLevel, hotelName, 3);
        const pricePerNight = estimateNightlyPrice(priceLevel, starRating);
        const neighborhood = extractNeighborhood(
          { formattedAddress: place.formattedAddress, addressComponents: place.addressComponents },
          hotelName,
          cityName
        );

        // Download photos to storage
        const photos: string[] = [];
        if (place.photos?.length > 0) {
          for (let i = 0; i < Math.min(place.photos.length, 3); i++) {
            try {
              const photo = place.photos[i];
              const cacheResult = await getCachedPlacesPhotoByResource(
                'hotel',
                `${place.id}-${i}`,
                photo.name,
                {
                  maxHeightPx: 800,
                  maxWidthPx: 1200,
                  metadata: { destination: cityName, placeName: hotelName, placeId: place.id },
                },
              );
              photos.push(cacheResult.url);
            } catch (e) {
              console.warn(`[Hotels] Photo fetch failed for ${hotelName}:`, e);
            }
          }
        }

        // Build Booking.com affiliate URL
        const cleanDest = cityName.replace(/\s*\([A-Z]{3}\)\s*/g, '').trim();
        const bookingQuery = encodeURIComponent(`${hotelName}, ${cleanDest}`);
        const bookingUrl = `https://www.booking.com/searchresults.html?ss=${bookingQuery}&checkin=${params.checkIn}&checkout=${params.checkOut}&group_adults=${params.guests || 1}&no_rooms=${params.rooms || 1}&dest_type=city`;

        return {
          id: place.id || `gp-hotel-${index}`,
          hotelId: place.id,
          name: hotelName,
          address: place.formattedAddress || '',
          city: cityName,
          location: cityName,
          neighborhood,
          rating: starRating,
          starRating,
          stars: starRating,
          pricePerNight,
          totalPrice: pricePerNight * nights,
          price: pricePerNight * nights,
          currency: 'USD',
          roomType: 'Standard Room',
          bedType: 1,
          description: `Comfortable stay at ${hotelName} in ${neighborhood}, ${cityName}`,
          imageUrl: photos[0] || null,
          photos,
          images: photos,
          amenities: ['WiFi', 'Air Conditioning'],
          cancellationPolicy: 'See hotel policy for details',
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          nights,
          latitude: place.location?.latitude || null,
          longitude: place.location?.longitude || null,
          reviewScore: place.rating ? place.rating * 2 : 8.0,
          reviewCount: place.userRatingCount || 0,
          googleReviewScore: place.rating || null,
          googleReviewCount: place.userRatingCount || null,
          website: place.websiteUri || null,
          googleMapsUrl: place.googleMapsUri || null,
          placeId: place.id,
          bookingUrl,
          source: 'google_places',
          _enriched: true,
        };
      })
    );

    logResultsSummary(results);

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
    const textQuery = `${query} hotel ${destination}`;
    console.log('[Hotels] Searching Google Places:', textQuery);

    const searchResult = await googlePlacesTextSearch(
      {
        textQuery,
        includedType: 'lodging',
        maxResultCount: 8,
        languageCode: 'en',
        fieldMask:
          'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.location,places.websiteUri,places.googleMapsUri,places.types',
      },
      { actionType: 'hotels_search_by_name', reason: textQuery },
    );

    if (!searchResult.ok) {
      console.error('[Hotels] Google Places error:', searchResult.errorText);
      return [];
    }

    const places = searchResult.data?.places || [];

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

    const enrichResult = await googlePlacesTextSearch(
      {
        textQuery,
        includedType: 'lodging',
        maxResultCount: 1,
        languageCode: 'en',
        fieldMask:
          'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.rating,places.userRatingCount,places.priceLevel,places.location,places.websiteUri,places.googleMapsUri,places.photos',
      },
      { actionType: 'hotels_enrich_by_name', reason: textQuery },
    );

    if (!enrichResult.ok) {
      console.error('[Hotels] Enrichment API error:', enrichResult.errorText);
      return { success: false, message: 'API error' };
    }

    const place = enrichResult.data?.places?.[0];

    if (!place) {
      console.log('[Hotels] No place found for:', hotelName);
      return { success: false, message: 'Hotel not found' };
    }

    // Download photos to Supabase Storage to avoid repeated Google API calls
    const photos: string[] = [];
    if (place.photos?.length > 0) {
      for (let i = 0; i < Math.min(place.photos.length, 5); i++) {
        const photo = place.photos[i];
        const cacheResult = await getCachedPlacesPhotoByResource(
          'hotel',
          `${place.id}-${i}`,
          photo.name,
          {
            maxHeightPx: 800,
            maxWidthPx: 1200,
            metadata: { destination, placeName: place.displayName?.text || hotelName, placeId: place.id },
          },
        );
        photos.push(cacheResult.url);
      }
      console.log(`[Hotels] Cached ${photos.length} photos for: ${hotelName}`);
    }

    return {
      success: true,
      enrichment: {
        placeId: place.id,
        name: place.displayName?.text || hotelName,
        address: place.formattedAddress,
        formattedAddress: place.formattedAddress,
        addressComponents: place.addressComponents,
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

  const response = await fetch(`${baseUrl}/v1/booking/hotel-bookings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bookingPayload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Hotels] Amadeus booking API error:', response.status, data);

    if (!isProduction && (response.status === 401 || response.status === 403 || response.status === 400)) {
      console.log('[Hotels] Sandbox mode - simulating successful booking');

      const simulatedConfirmation = `SIM-${Date.now().toString(36).toUpperCase()}`;
      const simulatedBookingId = `HBKG-${request.tripId.slice(0, 8).toUpperCase()}`;

      await supabase.from('trip_payments').update({
        status: 'completed',
        external_booking_id: simulatedBookingId,
        updated_at: new Date().toISOString(),
      }).eq('id', request.paymentId);

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

  await supabase.from('trip_payments').update({
    status: 'completed',
    external_booking_id: confirmationNumber,
    updated_at: new Date().toISOString(),
  }).eq('id', request.paymentId);

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
    const { data: trip, error } = await supabase
      .from('trips')
      .select('hotel_selection')
      .eq('id', tripId)
      .single();

    if (error || !trip) {
      console.warn('[Hotels] Could not fetch trip for confirmation update:', error);
      return;
    }

    let hotelSelection = trip.hotel_selection;
    
    if (Array.isArray(hotelSelection)) {
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

// ============= SERVER-SIDE DEDUP =============
const inflightSearches = new Map<string, Promise<Response>>();
const serverResultCache = new Map<string, { response: string; timestamp: number }>();
const SERVER_CACHE_TTL = 60_000; // 60 seconds

function makeSearchCacheKey(body: any): string {
  return JSON.stringify({
    d: (body.destination || body.city || '').toLowerCase().trim(),
    ci: body.checkIn || '',
    co: body.checkOut || '',
    g: body.guests || 1,
  });
}

// ============= HTTP HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const costTracker = trackCost('hotels_search', 'google_places');

  try {
    const body = await req.json();
    console.log('[Hotels] Request:', body.action || 'search');
    if (body.tripId) costTracker.setTripId(body.tripId);

    // Hotel booking action
    if (body.action === 'book') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'Authorization required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
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
      costTracker.recordGooglePlaces(1);
      await costTracker.save();
      
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
      costTracker.recordGooglePlaces(1);
      await costTracker.save();
      
      const result = await enrichHotelByName(body.hotelName, body.destination);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: search — with server-side dedup
    const dedupKey = makeSearchCacheKey(body);

    // Check server result cache
    const cachedResult = serverResultCache.get(dedupKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < SERVER_CACHE_TTL && !body.skipCache) {
      console.log(`[Hotels] 📦 Server result cache hit (${Math.round((Date.now() - cachedResult.timestamp) / 1000)}s old)`);
      return new Response(cachedResult.response, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check inflight dedup
    if (inflightSearches.has(dedupKey) && !body.skipCache) {
      console.log('[Hotels] ♻️ Server dedup: returning inflight result');
      return inflightSearches.get(dedupKey)!;
    }

    console.log('[Hotels] 🆕 New search for:', dedupKey);

    const searchPromise = (async () => {
      try {
        const hotels = await searchHotels(body);
        const enrichedCount = hotels.filter((h: any) => h._enriched).length;
        costTracker.recordGooglePlaces(1 + enrichedCount);
        await costTracker.save();
        
        const responseBody = JSON.stringify({
          success: true,
          hotels,
          count: hotels.length,
          source: hotels[0]?.source || 'unknown',
          enriched: enrichedCount,
        });

        // Cache result
        serverResultCache.set(dedupKey, { response: responseBody, timestamp: Date.now() });

        return new Response(responseBody, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } finally {
        // Clear inflight after 5 seconds
        setTimeout(() => inflightSearches.delete(dedupKey), 5_000);
      }
    })();

    inflightSearches.set(dedupKey, searchPromise);
    return searchPromise;

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
