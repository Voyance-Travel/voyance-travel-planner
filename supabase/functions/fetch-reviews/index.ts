import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { getCachedPhotoUrl } from "../_shared/photo-storage.ts";
import { cacheVenueResult } from "../_shared/venue-cache.ts";
import { googlePlacesTextSearch } from "../_shared/google-api.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// =============================================================================
// CACHING UTILITIES (24-hour TTL using search_cache table)
// =============================================================================

function generateCacheKey(placeName: string, destination: string): string {
  const normalized = `reviews:${placeName.toLowerCase().trim()}:${destination.toLowerCase().trim()}`;
  return normalized.replace(/\s+/g, '_').substring(0, 255);
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );
}

async function getCachedReviews(placeName: string, destination: string): Promise<ReviewsResponse | null> {
  try {
    const supabase = getSupabaseAdmin();
    const cacheKey = generateCacheKey(placeName, destination);
    
    const { data, error } = await supabase
      .from('search_cache')
      .select('results')
      .eq('search_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !data) return null;
    
    console.log(`[fetch-reviews] Cache HIT for "${placeName}" in ${destination}`);
    return data.results as ReviewsResponse;
  } catch {
    return null;
  }
}

async function cacheReviews(placeName: string, destination: string, response: ReviewsResponse): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const cacheKey = generateCacheKey(placeName, destination);
    // Cache reviews for 30 days - they don't change frequently
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('search_cache')
      .upsert({
        search_key: cacheKey,
        search_type: 'reviews',
        results: response,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }, { onConflict: 'search_key' });
    
    console.log(`[fetch-reviews] Cached reviews for "${placeName}" in ${destination} (30-day TTL)`);
  } catch (error) {
    console.error('[fetch-reviews] Cache write error:', error);
  }
}

// =============================================================================
// TYPES
// =============================================================================

interface ReviewRequest {
  placeName: string;
  destination: string;
  placeType?: 'restaurant' | 'attraction' | 'hotel' | 'activity';
  coordinates?: { lat: number; lng: number };
  maxReviews?: number;
}

interface Review {
  id: string;
  source: 'google' | 'tripadvisor' | 'foursquare' | 'opentripmap';
  authorName: string;
  authorPhoto?: string;
  rating: number; // 1-5
  text: string;
  relativeTime: string;
  publishedAt?: string;
  language?: string;
  photos?: string[];
  travelType?: string; // solo, couple, family, business
  visitDate?: string;
  helpful?: number;
}

interface PlaceDetails {
  name: string;
  address: string;
  rating: number;
  totalReviews: number;
  priceLevel?: number;
  categories?: string[];
  photos?: string[];
  website?: string;
  phone?: string;
  openNow?: boolean;
  openingHours?: string[];
  coordinates?: { lat: number; lng: number };
}

interface ReviewsResponse {
  success: boolean;
  place: PlaceDetails | null;
  reviews: Review[];
  sources: {
    google: boolean;
    tripadvisor: boolean;
    foursquare: boolean;
    opentripmap: boolean;
  };
  totalFetched: number;
}

// =============================================================================
// GOOGLE PLACES API
// =============================================================================

async function fetchGoogleReviews(
  placeName: string,
  destination: string,
  apiKey: string,
  maxReviews: number
): Promise<{ place: PlaceDetails | null; reviews: Review[] }> {
  try {
    // Step 1: Search for the place
    const searchQuery = `${placeName} ${destination}`;
    
    const searchResult = await googlePlacesTextSearch(
      {
        textQuery: searchQuery,
        maxResultCount: 1,
        languageCode: 'en',
        fieldMask:
          'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.location,places.photos,places.websiteUri,places.nationalPhoneNumber,places.currentOpeningHours,places.types,places.reviews',
      },
      { actionType: 'fetch_reviews_search', reason: searchQuery },
    );

    if (!searchResult.ok) {
      console.error('[Google] Search error:', searchResult.errorText);
      return { place: null, reviews: [] };
    }

    const places = searchResult.data?.places || [];

    if (places.length === 0) {
      console.log('[Google] No places found for:', searchQuery);
      return { place: null, reviews: [] };
    }

    const place = places[0];
    const displayName = place.displayName as { text: string } | undefined;
    const location = place.location as { latitude: number; longitude: number } | undefined;
    const photos = place.photos as Array<{ name: string }> | undefined;
    const openingHours = place.currentOpeningHours as { weekdayDescriptions?: string[]; openNow?: boolean } | undefined;
    const googleReviews = (place.reviews || []) as Array<{
      name: string;
      rating: number;
      text?: { text: string };
      originalText?: { text: string };
      authorAttribution?: { displayName: string; photoUri?: string };
      relativePublishTimeDescription?: string;
      publishTime?: string;
    }>;

    const placeDetails: PlaceDetails = {
      name: displayName?.text || placeName,
      address: (place.formattedAddress as string) || '',
      rating: (place.rating as number) || 0,
      totalReviews: (place.userRatingCount as number) || 0,
      priceLevel: parsePriceLevel(place.priceLevel as string),
      categories: ((place.types as string[]) || []).slice(0, 5),
      photos: [], // will be populated below after caching
      website: place.websiteUri as string | undefined,
      phone: place.nationalPhoneNumber as string | undefined,
      openNow: openingHours?.openNow,
      openingHours: openingHours?.weekdayDescriptions,
      coordinates: location ? { lat: location.latitude, lng: location.longitude } : undefined,
    };

    // Cache photos in our storage bucket to avoid per-render Google charges
    if (photos && photos.length > 0) {
      const cachedPhotos: string[] = [];
      for (const p of photos.slice(0, 5)) {
        const rawUrl = `https://places.googleapis.com/v1/${p.name}/media?maxHeightPx=400&key=${apiKey}`;
        try {
          const entityId = `review-${(place.id || placeName).toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 60)}-${cachedPhotos.length}`;
          const cached = await getCachedPhotoUrl('activity', entityId, rawUrl, {
            destination,
            placeName: displayName?.text || placeName,
            placeId: place.id,
          });
          cachedPhotos.push(cached.url);
        } catch {
          // Skip failed photos rather than leak raw URLs
          console.warn('[Google] Failed to cache review photo, skipping');
        }
      }
      placeDetails.photos = cachedPhotos;
    }

    // Store in shared venue cache for cross-function reuse
    if (place.id) {
      cacheVenueResult(placeName, destination, {
        placeId: place.id,
        name: displayName?.text || placeName,
        photoUrl: placeDetails.photos?.[0],
        address: placeDetails.address,
        rating: placeDetails.rating,
        totalReviews: placeDetails.totalReviews,
        types: placeDetails.categories,
        coordinates: placeDetails.coordinates,
      }).catch(() => {});
    }

    const reviews: Review[] = googleReviews.slice(0, maxReviews).map((r, idx) => ({
      id: `google_${idx}_${Date.now()}`,
      source: 'google' as const,
      authorName: r.authorAttribution?.displayName || 'Google User',
      authorPhoto: r.authorAttribution?.photoUri,
      rating: r.rating || 0,
      text: r.text?.text || r.originalText?.text || '',
      relativeTime: r.relativePublishTimeDescription || '',
      publishedAt: r.publishTime,
    }));

    console.log(`[Google] Found ${reviews.length} reviews for ${placeDetails.name}`);
    return { place: placeDetails, reviews };

  } catch (error) {
    console.error('[Google] Fetch error:', error);
    return { place: null, reviews: [] };
  }
}

function parsePriceLevel(priceLevel: string | undefined): number {
  if (!priceLevel) return 2;
  const mapping: Record<string, number> = {
    'PRICE_LEVEL_FREE': 1,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4,
  };
  return mapping[priceLevel] || 2;
}

// =============================================================================
// TRIPADVISOR API
// =============================================================================

async function fetchTripAdvisorReviews(
  placeName: string,
  destination: string,
  apiKey: string,
  maxReviews: number
): Promise<{ place: PlaceDetails | null; reviews: Review[] }> {
  try {
    // Step 1: Search for location
    const searchParams = new URLSearchParams({
      searchQuery: `${placeName} ${destination}`,
      language: 'en',
    });

    const searchResponse = await fetch(
      `https://api.content.tripadvisor.com/api/v1/location/search?${searchParams.toString()}&key=${apiKey}`,
      { headers: { accept: 'application/json' } }
    );

    if (!searchResponse.ok) {
      console.error('[TripAdvisor] Search error:', await searchResponse.text());
      return { place: null, reviews: [] };
    }

    const searchData = await searchResponse.json();
    const locations = searchData.data || [];

    if (locations.length === 0) {
      console.log('[TripAdvisor] No locations found');
      return { place: null, reviews: [] };
    }

    const locationId = locations[0].location_id;

    // Step 2: Get location details
    const detailsResponse = await fetch(
      `https://api.content.tripadvisor.com/api/v1/location/${locationId}/details?key=${apiKey}&language=en&currency=USD`,
      { headers: { accept: 'application/json' } }
    );

    let placeDetails: PlaceDetails | null = null;

    if (detailsResponse.ok) {
      const details = await detailsResponse.json();
      placeDetails = {
        name: details.name || placeName,
        address: details.address_obj?.address_string || '',
        rating: parseFloat(details.rating) || 0,
        totalReviews: parseInt(details.num_reviews) || 0,
        priceLevel: details.price_level ? details.price_level.length : undefined,
        categories: (details.cuisine || []).map((c: { name: string }) => c.name).slice(0, 5),
        photos: details.photo?.images?.large?.url ? [details.photo.images.large.url] : undefined,
        website: details.website,
        phone: details.phone,
        coordinates: details.latitude && details.longitude
          ? { lat: parseFloat(details.latitude), lng: parseFloat(details.longitude) }
          : undefined,
      };
    }

    // Step 3: Get reviews (request more to get a better selection)
    const reviewsResponse = await fetch(
      `https://api.content.tripadvisor.com/api/v1/location/${locationId}/reviews?key=${apiKey}&language=en&limit=20`,
      { headers: { accept: 'application/json' } }
    );

    if (!reviewsResponse.ok) {
      console.error('[TripAdvisor] Reviews error:', await reviewsResponse.text());
      return { place: placeDetails, reviews: [] };
    }

    const reviewsData = await reviewsResponse.json();
    const taReviews = (reviewsData.data || []) as Array<{
      id: number;
      rating: number;
      title?: string;
      text?: string;
      user?: { username: string; avatar?: { small?: { url: string } } };
      published_date?: string;
      travel_date?: string;
      trip_type?: string;
      helpful_votes?: number;
    }>;

    const reviews: Review[] = taReviews.slice(0, maxReviews).map(r => ({
      id: `tripadvisor_${r.id}`,
      source: 'tripadvisor' as const,
      authorName: r.user?.username || 'TripAdvisor User',
      authorPhoto: r.user?.avatar?.small?.url,
      rating: r.rating || 0,
      text: r.text || r.title || '',
      relativeTime: r.published_date ? formatRelativeTime(r.published_date) : '',
      publishedAt: r.published_date,
      visitDate: r.travel_date,
      travelType: r.trip_type,
      helpful: r.helpful_votes,
    }));

    console.log(`[TripAdvisor] Found ${reviews.length} reviews`);
    return { place: placeDetails, reviews };

  } catch (error) {
    console.error('[TripAdvisor] Fetch error:', error);
    return { place: null, reviews: [] };
  }
}

// =============================================================================
// FOURSQUARE API
// =============================================================================

async function fetchFoursquareReviews(
  placeName: string,
  destination: string,
  apiKey: string,
  maxReviews: number
): Promise<{ place: PlaceDetails | null; reviews: Review[] }> {
  try {
    // Determine if this is a v3 key (starts with fsq) or a v2 OAuth token
    const isV3Key = apiKey.startsWith('fsq');

    if (isV3Key) {
      // ===== V3 Places API =====
      const searchParams = new URLSearchParams({
        query: placeName,
        near: destination,
        limit: '1',
        fields: 'fsq_id,name,categories,rating,stats,price,location,photos,website,tel,hours,tips',
      });

      const searchResponse = await fetch(
        `https://api.foursquare.com/v3/places/search?${searchParams.toString()}`,
        {
          headers: {
            Authorization: apiKey,
            accept: 'application/json',
          },
        }
      );

      if (!searchResponse.ok) {
        console.error('[Foursquare v3] Search error:', await searchResponse.text());
        return { place: null, reviews: [] };
      }

      const searchData = await searchResponse.json();
      const results = searchData.results || [];

      if (results.length === 0) {
        console.log('[Foursquare v3] No places found');
        return { place: null, reviews: [] };
      }

      const place = results[0];
      const categories = (place.categories as Array<{ name: string }>) || [];
      const location = place.location as { formatted_address?: string; latitude?: number; longitude?: number } | undefined;
      const photos = place.photos as Array<{ prefix: string; suffix: string }> | undefined;
      const stats = place.stats as { total_ratings?: number } | undefined;
      const tips = place.tips as Array<{ id: string; created_at: string; text: string; agree_count?: number }> | undefined;

      const placeDetails: PlaceDetails = {
        name: (place.name as string) || placeName,
        address: location?.formatted_address || '',
        rating: ((place.rating as number) || 0) / 2, // Foursquare uses 0-10
        totalReviews: stats?.total_ratings || 0,
        priceLevel: place.price as number | undefined,
        categories: categories.map(c => c.name).slice(0, 5),
        photos: photos?.slice(0, 5).map(p => `${p.prefix}400x300${p.suffix}`),
        website: place.website as string | undefined,
        phone: place.tel as string | undefined,
        coordinates: location?.latitude && location?.longitude
          ? { lat: location.latitude, lng: location.longitude }
          : undefined,
      };

      const reviews: Review[] = (tips || []).slice(0, maxReviews).map(tip => ({
        id: `foursquare_${tip.id}`,
        source: 'foursquare' as const,
        authorName: 'Foursquare User',
        rating: 4,
        text: tip.text,
        relativeTime: formatRelativeTime(tip.created_at),
        publishedAt: tip.created_at,
        helpful: tip.agree_count,
      }));

      console.log(`[Foursquare v3] Found ${reviews.length} tips/reviews`);
      return { place: placeDetails, reviews };

    } else {
      // ===== V2 API (oauth_token style) =====
      // Step 1: Search for venue
      const v = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      const searchParams = new URLSearchParams({
        oauth_token: apiKey,
        v,
        query: placeName,
        near: destination,
        limit: '1',
      });

      const searchResponse = await fetch(
        `https://api.foursquare.com/v2/venues/search?${searchParams.toString()}`
      );

      if (!searchResponse.ok) {
        console.error('[Foursquare v2] Search error:', await searchResponse.text());
        return { place: null, reviews: [] };
      }

      const searchData = await searchResponse.json();
      const venues = searchData?.response?.venues || [];

      if (venues.length === 0) {
        console.log('[Foursquare v2] No venues found');
        return { place: null, reviews: [] };
      }

      const venue = venues[0];
      const venueId = venue.id as string;

      // Step 2: Get venue details (includes tips)
      const detailsParams = new URLSearchParams({ oauth_token: apiKey, v });
      const detailsResponse = await fetch(
        `https://api.foursquare.com/v2/venues/${venueId}?${detailsParams.toString()}`
      );

      if (!detailsResponse.ok) {
        console.error('[Foursquare v2] Details error:', await detailsResponse.text());
        return { place: null, reviews: [] };
      }

      const detailsData = await detailsResponse.json();
      const venueDetails = detailsData?.response?.venue;

      if (!venueDetails) {
        return { place: null, reviews: [] };
      }

      const categories = (venueDetails.categories as Array<{ name: string }>) || [];
      const location = venueDetails.location as { formattedAddress?: string[]; lat?: number; lng?: number } | undefined;
      const bestPhoto = venueDetails.bestPhoto as { prefix: string; suffix: string } | undefined;
      const price = venueDetails.price as { tier?: number } | undefined;
      const rating = venueDetails.rating as number | undefined;
      const ratingSignals = venueDetails.ratingSignals as number | undefined;
      const contact = venueDetails.contact as { formattedPhone?: string } | undefined;
      const url = venueDetails.url as string | undefined;

      const placeDetails: PlaceDetails = {
        name: (venueDetails.name as string) || placeName,
        address: location?.formattedAddress?.join(', ') || '',
        rating: rating ? rating / 2 : 0, // 0-10 -> 0-5
        totalReviews: ratingSignals || 0,
        priceLevel: price?.tier,
        categories: categories.map(c => c.name).slice(0, 5),
        photos: bestPhoto ? [`${bestPhoto.prefix}400x300${bestPhoto.suffix}`] : undefined,
        website: url,
        phone: contact?.formattedPhone,
        coordinates: location?.lat && location?.lng
          ? { lat: location.lat, lng: location.lng }
          : undefined,
      };

      // Tips from venue details
      const tipsGroup = venueDetails.tips?.groups?.[0]?.items || [];
      const reviews: Review[] = (tipsGroup as Array<{
        id: string;
        createdAt: number;
        text: string;
        agreeCount?: number;
        user?: { firstName?: string; lastName?: string; photo?: { prefix: string; suffix: string } };
      }>).slice(0, maxReviews).map(tip => ({
        id: `foursquare_${tip.id}`,
        source: 'foursquare' as const,
        authorName: tip.user ? `${tip.user.firstName || ''} ${tip.user.lastName || ''}`.trim() || 'Foursquare User' : 'Foursquare User',
        authorPhoto: tip.user?.photo ? `${tip.user.photo.prefix}100x100${tip.user.photo.suffix}` : undefined,
        rating: 4, // tips don't have individual ratings
        text: tip.text,
        relativeTime: formatRelativeTime(new Date(tip.createdAt * 1000).toISOString()),
        publishedAt: new Date(tip.createdAt * 1000).toISOString(),
        helpful: tip.agreeCount,
      }));

      console.log(`[Foursquare v2] Found ${reviews.length} tips/reviews`);
      return { place: placeDetails, reviews };
    }
  } catch (error) {
    console.error('[Foursquare] Fetch error:', error);
    return { place: null, reviews: [] };
  }
}

// =============================================================================
// OPENTRIPMAP API
// =============================================================================

async function fetchOpenTripMapReviews(
  placeName: string,
  destination: string,
  apiKey: string,
  maxReviews: number
): Promise<{ place: PlaceDetails | null; reviews: Review[] }> {
  try {
    // Use autosuggest API which is more forgiving with place names
    const searchQuery = `${placeName}, ${destination}`;
    const autosuggestResponse = await fetch(
      `https://api.opentripmap.com/0.1/en/places/autosuggest?name=${encodeURIComponent(searchQuery)}&radius=50000&limit=5&apikey=${apiKey}&lon=0&lat=0`
    );
    
    // If autosuggest fails, try a different approach with geoname for common city aliases
    const cityAliases: Record<string, string> = {
      'lisbon': 'Lisboa',
      'rome': 'Roma',
      'florence': 'Firenze',
      'venice': 'Venezia',
      'naples': 'Napoli',
      'munich': 'München',
      'vienna': 'Wien',
      'prague': 'Praha',
      'warsaw': 'Warszawa',
      'athens': 'Athina',
      'moscow': 'Moskva',
    };
    
    const cityName = destination.split(',')[0].trim().toLowerCase();
    const localizedCity = cityAliases[cityName] || destination;
    
    const geoResponse = await fetch(
      `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(localizedCity)}&apikey=${apiKey}`
    );
    
    if (!geoResponse.ok) {
      const errorText = await geoResponse.text();
      console.error('[OpenTripMap] Geocode error:', errorText);
      return { place: null, reviews: [] };
    }
    
    const geoData = await geoResponse.json();
    
    if (!geoData.lat || !geoData.lon) {
      console.log(`[OpenTripMap] Could not geocode "${localizedCity}" - trying direct text search`);
      return { place: null, reviews: [] };
    }
    
    console.log(`[OpenTripMap] Geocoded ${localizedCity} to ${geoData.lat}, ${geoData.lon}`);
    
    // Step 2: Search for places near the geocoded location
    const radius = 5000; // 5km radius
    const searchResponse = await fetch(
      `https://api.opentripmap.com/0.1/en/places/radius?radius=${radius}&lon=${geoData.lon}&lat=${geoData.lat}&name=${encodeURIComponent(placeName)}&rate=3&limit=5&apikey=${apiKey}`
    );
    
    if (!searchResponse.ok) {
      console.error('[OpenTripMap] Search error:', await searchResponse.text());
      return { place: null, reviews: [] };
    }
    
    const places = await searchResponse.json();
    if (!Array.isArray(places) || places.length === 0) {
      console.log('[OpenTripMap] No places found');
      return { place: null, reviews: [] };
    }
    
    // Find best match by comparing names
    const normalizedSearchName = placeName.toLowerCase().trim();
    const bestMatch = places.find((p: { name?: string }) => 
      p.name?.toLowerCase().includes(normalizedSearchName) ||
      normalizedSearchName.includes(p.name?.toLowerCase() || '')
    ) || places[0];
    
    const xid = bestMatch.xid;
    if (!xid) {
      return { place: null, reviews: [] };
    }
    
    // Step 3: Get detailed place info
    const detailsResponse = await fetch(
      `https://api.opentripmap.com/0.1/en/places/xid/${xid}?apikey=${apiKey}`
    );
    
    if (!detailsResponse.ok) {
      console.error('[OpenTripMap] Details error:', await detailsResponse.text());
      return { place: null, reviews: [] };
    }
    
    const details = await detailsResponse.json();
    
    // Build place details
    const placeDetails: PlaceDetails = {
      name: details.name || placeName,
      address: details.address?.road 
        ? `${details.address.road}${details.address.house_number ? ' ' + details.address.house_number : ''}, ${details.address.city || destination}`
        : destination,
      rating: details.rate ? Math.min(5, Math.ceil(details.rate / 2)) : 0,
      totalReviews: 0,
      categories: details.kinds?.split(',').slice(0, 5) || [],
      photos: details.preview?.source ? [details.preview.source] : undefined,
      website: details.url || details.wikipedia,
      coordinates: details.point ? { lat: details.point.lat, lng: details.point.lon } : undefined,
    };
    
    // OpenTripMap provides descriptions rather than individual reviews
    // Create a curated "review" from Wikipedia extract if available
    const reviews: Review[] = [];
    
    if (details.wikipedia_extracts?.text) {
      reviews.push({
        id: `opentripmap_wiki_${xid}`,
        source: 'opentripmap' as const,
        authorName: 'Wikipedia',
        rating: 5,
        text: details.wikipedia_extracts.text.substring(0, 500) + (details.wikipedia_extracts.text.length > 500 ? '...' : ''),
        relativeTime: 'Encyclopedia',
        publishedAt: new Date().toISOString(),
      });
    }
    
    // Add description as another "review" if different from Wikipedia
    if (details.otm && details.otm !== details.wikipedia_extracts?.text) {
      reviews.push({
        id: `opentripmap_desc_${xid}`,
        source: 'opentripmap' as const,
        authorName: 'OpenTripMap',
        rating: details.rate ? Math.min(5, Math.ceil(details.rate / 2)) : 4,
        text: details.otm.substring(0, 400),
        relativeTime: 'Curated Guide',
      });
    }
    
    console.log(`[OpenTripMap] Found ${reviews.length} descriptions/reviews for ${placeDetails.name}`);
    return { place: placeDetails, reviews };
    
  } catch (error) {
    console.error('[OpenTripMap] Fetch error:', error);
    return { place: null, reviews: [] };
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return '';
  }
}

function mergeReviews(
  googleReviews: Review[],
  tripAdvisorReviews: Review[],
  foursquareReviews: Review[],
  openTripMapReviews: Review[],
  maxTotal: number
): Review[] {
  // Strategy: Interleave reviews from all sources for variety
  const merged: Review[] = [];
  const sources = [googleReviews, tripAdvisorReviews, foursquareReviews, openTripMapReviews];
  let i = 0;

  // First pass: interleave reviews round-robin style
  while (merged.length < maxTotal) {
    let added = false;
    for (const source of sources) {
      if (source[i]) {
        merged.push(source[i]);
        if (merged.length >= maxTotal) break;
        added = true;
      }
    }
    if (!added) break;
    i++;
  }

  // Second pass: if we haven't hit maxTotal, add any remaining reviews
  if (merged.length < maxTotal) {
    for (const source of sources) {
      for (const review of source) {
        if (!merged.find(r => r.id === review.id)) {
          merged.push(review);
          if (merged.length >= maxTotal) break;
        }
      }
      if (merged.length >= maxTotal) break;
    }
  }

  console.log(`[mergeReviews] Merged ${merged.length} total from G:${googleReviews.length} TA:${tripAdvisorReviews.length} FS:${foursquareReviews.length} OTM:${openTripMapReviews.length}`);
  return merged;
}

function mergePlaceDetails(
  google: PlaceDetails | null,
  tripAdvisor: PlaceDetails | null,
  foursquare: PlaceDetails | null,
  openTripMap: PlaceDetails | null
): PlaceDetails | null {
  // Prefer Google, then TripAdvisor, then Foursquare, then OpenTripMap
  const primary = google || tripAdvisor || foursquare || openTripMap;
  if (!primary) return null;

  // Merge photos from all sources
  const allPhotos: string[] = [];
  if (google?.photos) allPhotos.push(...google.photos);
  if (tripAdvisor?.photos) allPhotos.push(...tripAdvisor.photos);
  if (foursquare?.photos) allPhotos.push(...foursquare.photos);
  if (openTripMap?.photos) allPhotos.push(...openTripMap.photos);

  // Calculate weighted average rating
  let totalWeight = 0;
  let weightedRating = 0;
  let totalReviews = 0;

  for (const p of [google, tripAdvisor, foursquare, openTripMap]) {
    if (p && p.rating > 0 && p.totalReviews > 0) {
      const weight = Math.log10(p.totalReviews + 1);
      weightedRating += p.rating * weight;
      totalWeight += weight;
      totalReviews += p.totalReviews;
    }
  }

  return {
    ...primary,
    rating: totalWeight > 0 ? Math.round((weightedRating / totalWeight) * 10) / 10 : primary.rating,
    totalReviews,
    photos: allPhotos.slice(0, 8),
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ReviewRequest = await req.json();
    const {
      placeName,
      destination,
      maxReviews = 10,
    } = body;

    if (!placeName || !destination) {
      return new Response(
        JSON.stringify({ success: false, error: 'placeName and destination are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fetch-reviews] Fetching reviews for "${placeName}" in ${destination}`);

    // Check cache first (24-hour TTL)
    const cachedResult = await getCachedReviews(placeName, destination);
    if (cachedResult) {
      return new Response(
        JSON.stringify(cachedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API keys
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const TRIPADVISOR_API_KEY = Deno.env.get('TRIPADVISOR_API_KEY');
    const FOURSQUARE_API_KEY = Deno.env.get('FOURSQUARE_API_KEY');
    const OPENTRIPMAP_API_KEY = Deno.env.get('OPENTRIPMAP_API_KEY');

    // Fetch from all available APIs in parallel
    const promises: Promise<{ place: PlaceDetails | null; reviews: Review[] }>[] = [];

    if (GOOGLE_MAPS_API_KEY) {
      promises.push(fetchGoogleReviews(placeName, destination, GOOGLE_MAPS_API_KEY, maxReviews));
    } else {
      promises.push(Promise.resolve({ place: null, reviews: [] }));
    }

    if (TRIPADVISOR_API_KEY) {
      promises.push(fetchTripAdvisorReviews(placeName, destination, TRIPADVISOR_API_KEY, maxReviews));
    } else {
      promises.push(Promise.resolve({ place: null, reviews: [] }));
    }

    if (FOURSQUARE_API_KEY) {
      promises.push(fetchFoursquareReviews(placeName, destination, FOURSQUARE_API_KEY, maxReviews));
    } else {
      promises.push(Promise.resolve({ place: null, reviews: [] }));
    }

    if (OPENTRIPMAP_API_KEY) {
      promises.push(fetchOpenTripMapReviews(placeName, destination, OPENTRIPMAP_API_KEY, maxReviews));
    } else {
      promises.push(Promise.resolve({ place: null, reviews: [] }));
    }

    const [googleResult, tripAdvisorResult, foursquareResult, openTripMapResult] = await Promise.all(promises);

    // Merge place details (now includes OpenTripMap)
    const mergedPlace = mergePlaceDetails(
      googleResult.place,
      tripAdvisorResult.place,
      foursquareResult.place,
      openTripMapResult.place
    );

    // Merge and interleave reviews (now includes OpenTripMap)
    const mergedReviews = mergeReviews(
      googleResult.reviews,
      tripAdvisorResult.reviews,
      foursquareResult.reviews,
      openTripMapResult.reviews,
      maxReviews
    );

    const response: ReviewsResponse = {
      success: true,
      place: mergedPlace,
      reviews: mergedReviews,
      sources: {
        google: !!GOOGLE_MAPS_API_KEY && googleResult.reviews.length > 0,
        tripadvisor: !!TRIPADVISOR_API_KEY && tripAdvisorResult.reviews.length > 0,
        foursquare: !!FOURSQUARE_API_KEY && foursquareResult.reviews.length > 0,
        opentripmap: !!OPENTRIPMAP_API_KEY && openTripMapResult.reviews.length > 0,
      },
      totalFetched: mergedReviews.length,
    };

    // Cache the response for 24 hours
    await cacheReviews(placeName, destination, response);

    console.log(`[fetch-reviews] Returning ${response.totalFetched} reviews from ${Object.values(response.sources).filter(Boolean).length} sources`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fetch-reviews] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reviews',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
