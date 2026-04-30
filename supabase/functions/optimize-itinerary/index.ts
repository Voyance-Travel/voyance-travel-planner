import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost } from "../_shared/cost-tracker.ts";
import {
  googleGeocode,
  googlePlacesTextSearch,
  googleRoutes,
  googleDistanceMatrix,
} from "../_shared/google-api.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// =============================================================================
// TYPES
// =============================================================================

interface ActivityLocation {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  // AI may generate nested coordinates structure
  coordinates?: { lat: number; lng: number };
}

interface Activity {
  id: string;
  title: string;
  description?: string;
  category?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  location?: ActivityLocation;
  cost?: { amount: number | null; currency: string };
  isLocked?: boolean;
  transportation?: TransportData;
  durationMinutes?: number;
  timeBlockType?: string;
  tags?: string[];
}

// Helper to get coordinates from activity location (handles both flat and nested structures)
function getCoordinates(location?: ActivityLocation): { lat: number; lng: number } | null {
  if (!location) return null;
  
  // Check flat structure first (location.lat, location.lng)
  if (typeof location.lat === 'number' && typeof location.lng === 'number') {
    if (location.lat !== 0 || location.lng !== 0) {
      return { lat: location.lat, lng: location.lng };
    }
  }
  
  // Check nested structure (location.coordinates.lat, location.coordinates.lng)
  if (location.coordinates && typeof location.coordinates.lat === 'number' && typeof location.coordinates.lng === 'number') {
    if (location.coordinates.lat !== 0 || location.coordinates.lng !== 0) {
      return { lat: location.coordinates.lat, lng: location.coordinates.lng };
    }
  }
  
  return null;
}

// Build a routable address string even when we don't have coordinates.
// Google APIs can accept addresses directly, which lets us get transit line + stop details.
function getRoutingAddress(location?: ActivityLocation, city?: string): string | null {
  if (!location) return null;

  const base = (location.address || location.name || '').trim();
  if (!base) return null;

  if (city) {
    const baseLower = base.toLowerCase();
    const cityLower = city.toLowerCase();
    // Avoid duplicating city if the address already contains it
    if (!baseLower.includes(cityLower)) {
      return `${base}, ${city}`;
    }
  }

  return base;
}

interface TransportData {
  method: string;
  duration: string;
  durationMinutes?: number;
  distance?: string;
  distanceMeters?: number;
  estimatedCost?: { amount: number; currency: string };
  instructions?: string;
}

interface Day {
  dayNumber: number;
  date?: string;
  title?: string;
  activities: Activity[];
  metadata?: {
    totalEstimatedCost?: number;
    pacingLevel?: string;
    theme?: string;
  };
}

// Transport mode options (from user preferences dialog)
type TransportModeOption = 'bus' | 'train' | 'rideshare' | 'taxi' | 'walking' | 'cheapest';
type DistanceUnit = 'km' | 'miles';

interface TransportPreferences {
  allowedModes?: TransportModeOption[];
  distanceUnit?: DistanceUnit;
}

interface OptimizeRequest {
  tripId: string;
  destination: string;
  days: Day[];
  userId?: string; // If provided, fetch user's itinerary preferences
  enableRouteOptimization?: boolean;
  enableRealTransport?: boolean;
  enableCostLookup?: boolean;
  enableGapFilling?: boolean;
  enableTagGeneration?: boolean;
  enableGeocoding?: boolean;
  enableVenueVerification?: boolean;
  preferredDowntimeMinutes?: number;
  maxActivitiesPerDay?: number;
  currency?: string;
  travelers?: number;
  nights?: number;
  budgetTier?: string;
  transportPreferences?: TransportPreferences;
}

interface UserItineraryPreferences {
  enable_gap_filling: boolean;
  enable_route_optimization: boolean;
  enable_real_transport: boolean;
  enable_geocoding: boolean;
  enable_venue_verification: boolean;
  enable_cost_lookup: boolean;
  preferred_downtime_minutes: number;
  max_activities_per_day: number;
}

// =============================================================================
// ALGORITHM 1: COST EXTRACTION (from text descriptions)
// Pattern matching for "$25", "€30", "free admission", etc.
// =============================================================================

function extractCost(
  description: string | undefined,
  defaultCurrency: string = 'USD'
): { amount: number; currency: string } | null {
  if (!description) return null;

  const patterns = [
    { regex: /\$(\d+(?:\.\d{2})?)/i, currency: 'USD' },
    { regex: /€(\d+(?:\.\d{2})?)/i, currency: 'EUR' },
    { regex: /£(\d+(?:\.\d{2})?)/i, currency: 'GBP' },
    { regex: /¥(\d+(?:,\d{3})*(?:\.\d{2})?)/i, currency: 'JPY' },
    { regex: /(\d+(?:\.\d{2})?)\s*(USD|EUR|GBP|JPY|AUD|CAD)/i, currency: 'MATCH' },
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern.regex);
    if (match) {
      const amount = parseFloat(match[1].replace(',', ''));
      const currency = pattern.currency === 'MATCH' ? (match[2]?.toUpperCase() || defaultCurrency) : pattern.currency;
      return { amount, currency };
    }
  }

  // Check for "free" keywords
  const freeKeywords = ['free', 'no cost', 'no charge', 'complimentary', 'gratis', 'free admission', 'free entry'];
  const lowercaseDesc = description.toLowerCase();
  for (const keyword of freeKeywords) {
    if (lowercaseDesc.includes(keyword)) {
      return { amount: 0, currency: defaultCurrency };
    }
  }

  return null;
}

// =============================================================================
// ALGORITHM 2: DURATION CALCULATION
// Convert HH:MM times to minutes, with fallbacks
// =============================================================================

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(p => parseInt(p, 10));
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function calculateDuration(
  startTime?: string,
  endTime?: string,
  nextStartTime?: string
): number {
  if (!startTime) return 90; // Default 90 minutes

  const start = timeToMinutes(startTime);

  // Case 1: Valid explicit end time
  if (endTime) {
    const end = timeToMinutes(endTime);
    if (end > start) return end - start;
  }

  // Case 2: Infer from next activity
  if (nextStartTime) {
    const nextStart = timeToMinutes(nextStartTime);
    if (nextStart > start) return nextStart - start;
  }

  // Case 3: Default duration
  return 90;
}

// =============================================================================
// ALGORITHM 3: GAP FILLING
// Insert downtime blocks for gaps exceeding user-configured minimum
// =============================================================================

const DEFAULT_MIN_GAP_MINUTES = 30;

function createDowntimeBlock(startTime: string, endTime: string, durationMinutes: number): Activity {
  return {
    id: `downtime-${startTime}-${endTime}`,
    title: 'Free Time',
    description: `${durationMinutes} minutes of free time to explore, rest, or grab a snack`,
    startTime,
    endTime,
    category: 'relaxation',
    type: 'downtime',
    location: {
      name: 'Flexible',
      address: 'Your choice',
    },
    cost: { amount: 0, currency: 'USD' },
    timeBlockType: 'downtime',
    durationMinutes,
    tags: ['free-time', 'flexible', 'downtime', 'rest'],
    transportation: {
      method: 'walk',
      duration: '0 min',
      estimatedCost: { amount: 0, currency: 'USD' },
      instructions: 'No transportation needed',
    },
  };
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function fillGaps(activities: Activity[], minGapMinutes: number = DEFAULT_MIN_GAP_MINUTES): Activity[] {
  if (activities.length === 0) return [];

  const result: Activity[] = [];

  for (let i = 0; i < activities.length; i++) {
    const current = activities[i];
    result.push(current);

    if (i < activities.length - 1) {
      const next = activities[i + 1];

      if (current.endTime && next.startTime) {
        const currentEnd = timeToMinutes(current.endTime);
        const nextStart = timeToMinutes(next.startTime);
        const gap = nextStart - currentEnd;

        if (gap >= minGapMinutes) {
          const downtime = createDowntimeBlock(
            current.endTime,
            next.startTime,
            gap
          );
          result.push(downtime);
          console.log(`[optimize-itinerary] Inserted ${gap}min downtime between "${current.title}" and "${next.title}"`);
        } else if (gap < 0) {
          console.warn(`[optimize-itinerary] Activity overlap: "${current.title}" ends at ${current.endTime}, "${next.title}" starts at ${next.startTime}`);
        }
      }
    }
  }

  return result;
}

// =============================================================================
// ALGORITHM 4: TAG GENERATION WITH CACHING
// Generate comprehensive tags based on category, keywords, cost, time
// Tags are cached by activity ID to avoid regenerating for the same content
// =============================================================================

// In-memory tag cache (persists for function lifetime)
const tagCache = new Map<string, { tags: string[]; hash: string }>();

function hashActivityContent(title: string, description: string | undefined, category: string | undefined): string {
  return `${title}|${description || ''}|${category || ''}`.toLowerCase();
}

function generateTags(
  title: string,
  description: string | undefined,
  category: string | undefined,
  existingTags: string[] = [],
  cost: number | null | undefined,
  activityId?: string
): string[] {
  // Check cache first
  const contentHash = hashActivityContent(title, description, category);
  if (activityId) {
    const cached = tagCache.get(activityId);
    if (cached && cached.hash === contentHash && cached.tags.length >= 5) {
      return cached.tags;
    }
  }
  
  // If AI already provided good tags (5+), use them and cache
  if (existingTags.length >= 5) {
    if (activityId) {
      tagCache.set(activityId, { tags: existingTags, hash: contentHash });
    }
    return existingTags;
  }
  
  const tags = new Set<string>(existingTags);
  const combined = `${title} ${description || ''}`.toLowerCase();

  // Category-based tags
  const categoryTagMap: Record<string, string[]> = {
    sightseeing: ['sightseeing', 'attraction', 'landmark', 'must-see'],
    dining: ['food', 'restaurant', 'dining', 'culinary'],
    cultural: ['culture', 'history', 'art', 'educational'],
    shopping: ['shopping', 'market', 'souvenirs', 'local-goods'],
    relaxation: ['relaxation', 'leisure', 'chill', 'wellness'],
    transport: ['transport', 'travel', 'logistics'],
    accommodation: ['accommodation', 'hotel', 'lodging'],
    activity: ['activity', 'experience', 'adventure'],
  };

  const catLower = (category || '').toLowerCase();
  if (categoryTagMap[catLower]) {
    categoryTagMap[catLower].forEach(t => tags.add(t));
  }

  // Keyword-based tags (expanded)
  const keywordMap: Record<string, string[]> = {
    museum: ['museum', 'art', 'history', 'educational', 'indoor'],
    gallery: ['gallery', 'art', 'exhibition', 'indoor'],
    park: ['park', 'outdoor', 'nature', 'scenic', 'photo-op'],
    garden: ['garden', 'nature', 'peaceful', 'outdoor'],
    temple: ['temple', 'religious', 'spiritual', 'historic'],
    church: ['church', 'religious', 'architecture', 'historic'],
    palace: ['palace', 'royal', 'historic', 'architecture', 'must-see'],
    castle: ['castle', 'historic', 'medieval', 'landmark'],
    market: ['market', 'shopping', 'local', 'authentic', 'food'],
    beach: ['beach', 'seaside', 'outdoor', 'relaxation', 'scenic'],
    tower: ['tower', 'views', 'landmark', 'photo-op', 'panoramic'],
    viewpoint: ['viewpoint', 'scenic', 'panoramic', 'photo-op'],
    restaurant: ['restaurant', 'food', 'dining', 'culinary'],
    cafe: ['cafe', 'coffee', 'casual', 'cozy'],
    bar: ['bar', 'drinks', 'nightlife', 'evening'],
    pub: ['pub', 'drinks', 'local', 'casual'],
    tour: ['tour', 'guided', 'group', 'educational'],
    walk: ['walking', 'outdoor', 'exploration', 'exercise'],
    cruise: ['cruise', 'boat', 'water', 'scenic', 'romantic'],
    show: ['show', 'entertainment', 'performance', 'evening'],
    theater: ['theater', 'performance', 'culture', 'evening'],
    concert: ['concert', 'music', 'entertainment', 'evening'],
    spa: ['spa', 'wellness', 'relaxation', 'luxury', 'pampering'],
    sunset: ['sunset', 'romantic', 'scenic', 'evening', 'photo-op'],
    sunrise: ['sunrise', 'morning', 'scenic', 'early-bird', 'photo-op'],
    breakfast: ['breakfast', 'morning', 'food', 'start-of-day'],
    lunch: ['lunch', 'afternoon', 'food', 'midday'],
    dinner: ['dinner', 'evening', 'food', 'culinary'],
  };

  for (const [keyword, keywordTags] of Object.entries(keywordMap)) {
    if (combined.includes(keyword)) {
      keywordTags.forEach(t => tags.add(t));
    }
  }

  // Cost-based tags
  if (cost === 0 || cost === null) {
    tags.add('free');
  } else if (cost !== undefined && cost < 15) {
    tags.add('budget-friendly');
  } else if (cost !== undefined && cost < 50) {
    tags.add('moderate-price');
  } else if (cost !== undefined && cost >= 100) {
    tags.add('premium');
    tags.add('splurge');
  }

  // Time-based tags
  const timeKeywords: Record<string, string> = {
    morning: 'morning',
    breakfast: 'morning',
    afternoon: 'afternoon',
    lunch: 'afternoon',
    evening: 'evening',
    dinner: 'evening',
    sunset: 'sunset',
    sunrise: 'sunrise',
    night: 'night',
  };

  for (const [keyword, timeTag] of Object.entries(timeKeywords)) {
    if (combined.includes(keyword)) {
      tags.add(timeTag);
    }
  }

  // Experience-based tags
  if (combined.includes('family') || combined.includes('kids')) {
    tags.add('family-friendly');
  }
  if (combined.includes('photo') || combined.includes('view') || combined.includes('scenic')) {
    tags.add('photo-op');
    tags.add('instagram-worthy');
  }
  if (combined.includes('romantic') || combined.includes('couples')) {
    tags.add('romantic');
  }
  if (combined.includes('adventure') || combined.includes('adrenaline')) {
    tags.add('adventure');
  }
  if (combined.includes('authentic') || combined.includes('local')) {
    tags.add('authentic');
    tags.add('local-experience');
  }

  return Array.from(tags);
}

// =============================================================================
// ALGORITHM 5: PACING LEVEL CALCULATION
// ≤3 = relaxed, 4-5 = moderate, ≥6 = packed
// =============================================================================

function calculatePacingLevel(activityCount: number): 'relaxed' | 'moderate' | 'packed' {
  if (activityCount <= 3) return 'relaxed';
  if (activityCount <= 5) return 'moderate';
  return 'packed';
}

// =============================================================================
// ALGORITHM 6: GEOCODING (Google Geocoding API)
// Convert addresses to coordinates with 4-decimal precision
// =============================================================================

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
}

async function geocodeAddress(
  address: string,
  destination: string,
  supabase?: any
): Promise<GeocodingResult | null> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || Deno.env.get("GOOGLE_GEOCODE_API_KEY");
  if (!apiKey) return null;

  // Generate cache key from normalized address + destination
  const queryKey = `${address.toLowerCase().trim()}|${destination.toLowerCase().trim()}`.replace(/[^a-z0-9|]/g, '');

  // Check cache first
  if (supabase) {
    try {
      const { data: cached } = await supabase
        .from('geocoding_cache')
        .select('lat, lng, formatted_address, place_id, expires_at')
        .eq('query_key', queryKey)
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        console.log(`[geocoding] ✅ Cache hit for: ${address}`);
        return {
          lat: cached.lat,
          lng: cached.lng,
          formattedAddress: cached.formatted_address,
          placeId: cached.place_id,
        };
      }
    } catch {
      // Cache miss, continue to API
    }
  }

  try {
    const geo = await googleGeocode(
      { address: `${address}, ${destination}` },
      { actionType: 'optimize_itinerary', reason: `geocode: ${address}` },
    );

    if (!geo.ok || geo.data?.status !== 'OK' || !geo.data?.results?.[0]) {
      console.warn(`[geocoding] No results for: ${address}`);
      return null;
    }

    const result = geo.data.results[0];
    const location = result.geometry.location;

    const geocodeResult: GeocodingResult = {
      lat: Math.round(location.lat * 10000) / 10000, // 4 decimal precision
      lng: Math.round(location.lng * 10000) / 10000,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };

    // Cache the result for 90 days
    if (supabase) {
      try {
        await supabase.from('geocoding_cache').upsert({
          query_key: queryKey,
          address: address,
          destination: destination,
          lat: geocodeResult.lat,
          lng: geocodeResult.lng,
          formatted_address: geocodeResult.formattedAddress,
          place_id: geocodeResult.placeId,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'query_key' });
        console.log(`[geocoding] Cached result for: ${address}`);
      } catch (e) {
        console.warn('[geocoding] Failed to cache:', e);
      }
    }

    return geocodeResult;
  } catch (error) {
    console.error(`[geocoding] Error for ${address}:`, error);
    return null;
  }
}

// =============================================================================
// ALGORITHM 7: VENUE VERIFICATION (Lightweight Version)
// Uses string similarity + coordinate validation instead of expensive API calls
// Only falls back to Google Places if explicitly enabled and has coordinates mismatch
// =============================================================================

interface VerificationResult {
  isValid: boolean;
  confidence: number;
  placeId?: string;
  name?: string;
  rating?: number;
  userRatingsTotal?: number;
  location?: { lat: number; lng: number };
  formattedAddress?: string;
  openingHours?: string[];
}

// Known landmark coordinates for validation (expandable cache)
const LANDMARK_CACHE: Record<string, { lat: number; lng: number; radius: number }> = {
  // Paris
  'eiffel tower': { lat: 48.8584, lng: 2.2945, radius: 0.01 },
  'louvre': { lat: 48.8606, lng: 2.3376, radius: 0.01 },
  'notre dame': { lat: 48.8530, lng: 2.3499, radius: 0.01 },
  'arc de triomphe': { lat: 48.8738, lng: 2.2950, radius: 0.01 },
  // London
  'tower of london': { lat: 51.5081, lng: -0.0759, radius: 0.01 },
  'big ben': { lat: 51.5007, lng: -0.1246, radius: 0.01 },
  'british museum': { lat: 51.5194, lng: -0.1270, radius: 0.01 },
  // More can be added dynamically
};

function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const matchingWords = words1.filter(w => words2.includes(w)).length;
  const totalWords = Math.max(words1.length, words2.length);

  return totalWords > 0 ? matchingWords / totalWords : 0;
}

// Lightweight verification using known landmarks + coordinate validation
function verifyVenueLightweight(
  venueName: string,
  location?: { lat?: number; lng?: number }
): VerificationResult {
  const nameLower = venueName.toLowerCase();
  
  // Check against known landmarks
  for (const [landmark, coords] of Object.entries(LANDMARK_CACHE)) {
    if (nameLower.includes(landmark) || calculateStringSimilarity(nameLower, landmark) > 0.7) {
      // If we have coordinates, check if they're close to known location
      if (location?.lat && location?.lng) {
        const latDiff = Math.abs(location.lat - coords.lat);
        const lngDiff = Math.abs(location.lng - coords.lng);
        if (latDiff < coords.radius && lngDiff < coords.radius) {
          return { isValid: true, confidence: 0.95, location: { lat: coords.lat, lng: coords.lng } };
        }
      }
      // Trust the landmark name even without exact coordinate match
      return { isValid: true, confidence: 0.85, location: { lat: coords.lat, lng: coords.lng } };
    }
  }
  
  // For non-landmarks, trust AI coordinates if provided
  if (location?.lat && location?.lng) {
    // Basic sanity check: lat should be -90 to 90, lng should be -180 to 180
    const validLat = location.lat >= -90 && location.lat <= 90;
    const validLng = location.lng >= -180 && location.lng <= 180;
    if (validLat && validLng) {
      return { isValid: true, confidence: 0.75, location: { lat: location.lat, lng: location.lng } };
    }
  }
  
  // Can't verify - mark as unverified but not invalid
  return { isValid: false, confidence: 0.5 };
}

// Full verification (expensive - only use when explicitly enabled)
async function verifyVenue(
  venueName: string,
  destination: string,
  category?: string
): Promise<VerificationResult> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return { isValid: false, confidence: 0 };
  }

  try {
    // Get destination center for distance check
    let destCenter: { lat: number; lng: number } | null = null;
    try {
      const geoRes = await googleGeocode(
        { address: destination },
        { actionType: 'optimize_itinerary', reason: `verify-venue center: ${destination}` },
      );
      const loc = geoRes.data?.results?.[0]?.geometry?.location;
      if (loc) destCenter = { lat: loc.lat, lng: loc.lng };
    } catch { /* ignore */ }

    const searchRes = await googlePlacesTextSearch(
      {
        textQuery: `${venueName} ${destination}`,
        fieldMask: "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.regularOpeningHours",
        maxResultCount: 1,
      },
      { actionType: 'optimize_itinerary', reason: `verify-venue: ${venueName}` },
    );

    if (!searchRes.ok) {
      return { isValid: false, confidence: 0 };
    }

    const place = searchRes.data?.places?.[0];
    if (!place) {
      return { isValid: false, confidence: 0 };
    }

    const placeName: string = place.displayName?.text || '';
    const placeLoc = place.location ? { lat: place.location.latitude, lng: place.location.longitude } : null;

    // Distance guard: reject venues >50km from destination
    if (destCenter && placeLoc) {
      const R = 6371;
      const dLat = (placeLoc.lat - destCenter.lat) * Math.PI / 180;
      const dLng = (placeLoc.lng - destCenter.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(destCenter.lat * Math.PI / 180) * Math.cos(placeLoc.lat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (distKm > 50) {
        console.log(`[venue-verification] ❌ REJECTED "${venueName}" → "${placeName}" is ${distKm.toFixed(0)}km from ${destination}`);
        return { isValid: false, confidence: 0 };
      }
    }

    const similarity = calculateStringSimilarity(venueName, placeName);
    const ratingBoost = (place.rating || 0) >= 4.0 ? 0.1 : 0;
    const confidence = Math.min(similarity + ratingBoost, 1.0);

    return {
      isValid: confidence >= 0.7,
      confidence,
      placeId: place.id,
      name: placeName,
      rating: place.rating,
      userRatingsTotal: place.userRatingCount,
      location: placeLoc ?? undefined,
      formattedAddress: place.formattedAddress,
      openingHours: place.regularOpeningHours?.weekdayDescriptions,
    };
  } catch (error) {
    console.error(`[venue-verification] Error for ${venueName}:`, error);
    return { isValid: false, confidence: 0 };
  }
}

// =============================================================================
// ALGORITHM 8: PHOTO ENRICHMENT (Pexels API with fallback queries)
// =============================================================================

interface PhotoResult {
  url: string;
  thumbnailUrl?: string;
  photographer: string;
  alt: string;
}

async function getActivityPhotos(
  activityTitle: string,
  locationName: string,
  destination: string,
  maxPhotos: number = 2
): Promise<PhotoResult[]> {
  const apiKey = Deno.env.get("PEXELS_API_KEY");
  if (!apiKey) return [];

  // Search queries in priority order
  const searchQueries = [
    locationName,
    `${locationName} ${destination}`,
    `${activityTitle} ${destination}`,
    destination,
  ];

  for (const query of searchQueries) {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${maxPhotos}&orientation=landscape`;
      const response = await fetch(url, {
        headers: { Authorization: apiKey },
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data.photos?.length > 0) {
        return data.photos.slice(0, maxPhotos).map((photo: {
          src: { large: string; medium: string };
          photographer: string;
          photographer_url: string;
          alt: string;
        }) => ({
          url: photo.src.large,
          thumbnailUrl: photo.src.medium,
          photographer: photo.photographer,
          alt: photo.alt || `${activityTitle} in ${destination}`,
        }));
      }
    } catch (error) {
      console.warn(`[photos] Search failed for "${query}":`, error);
    }
  }

  return [];
}

// =============================================================================
// ALGORITHM 9: HOTEL PRICE SCALING (Amadeus Sandbox Fix)
// Scale prices: price_total = base × (nights_actual/nights_simple) × √(adults_actual/adults_simple)
// =============================================================================

function scaleHotelPrice(
  simplifiedPrice: number,
  originalNights: number,
  originalAdults: number,
  simplifiedNights: number = 1,
  simplifiedAdults: number = 1
): number {
  // Nights multiplier (linear)
  const nightsMultiplier = originalNights / simplifiedNights;
  
  // Guests multiplier (square root - additional guests share resources)
  const guestsMultiplier = Math.sqrt(originalAdults / simplifiedAdults);
  
  // Apply scaling
  const scaledPrice = simplifiedPrice * nightsMultiplier * guestsMultiplier;
  
  return Math.round(scaledPrice);
}

// =============================================================================
// ALGORITHM 5: ROUTE OPTIMIZATION (Nearest Neighbor TSP)
// Minimize total travel distance while respecting locked activities
// =============================================================================

function getHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Build distance matrix for all activities with coordinates
function buildDistanceMatrix(activities: Activity[]): number[][] {
  const n = activities.length;
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        const a = activities[i];
        const b = activities[j];
        const coordsA = getCoordinates(a.location);
        const coordsB = getCoordinates(b.location);
        if (coordsA && coordsB) {
          matrix[i][j] = getHaversineDistance(
            coordsA.lat, coordsA.lng,
            coordsB.lat, coordsB.lng
          );
        } else {
          matrix[i][j] = Infinity; // No coordinates
        }
      }
    }
  }

  return matrix;
}

function optimizeDayRoute(activities: Activity[]): { activities: Activity[]; changed: boolean } {
  // Identify locked activities (meals, specific timed events)
  const lockedWithIndex = activities
    .map((act, idx) => ({ act, idx, isLocked: act.isLocked || false }))
    .filter(item => item.isLocked);

  const unlocked = activities.filter(act => !act.isLocked);

  // If ≤1 unlocked activities, nothing to optimize
  if (unlocked.length <= 1) return { activities, changed: false };

  // Split unlocked into those with and without coordinates
  const withCoords = unlocked.filter(a => getCoordinates(a.location) !== null);
  const withoutCoords = unlocked.filter(a => getCoordinates(a.location) === null);

  if (withCoords.length <= 1) {
    console.log(`[optimize-itinerary] Only ${withCoords.length} activities have coordinates (${withoutCoords.length} missing), skipping route optimization`);
    return { activities, changed: false };
  }

  console.log(`[optimize-itinerary] Optimizing ${withCoords.length} activities with coords (${withoutCoords.length} without coords will stay in place)`);

  // Build distance matrix for activities WITH coordinates only
  const distMatrix = buildDistanceMatrix(withCoords);

  // Nearest Neighbor TSP on the coord-having subset
  const optimizedIndices: number[] = [];
  const visited = new Set<number>();

  let current = 0;
  visited.add(current);
  optimizedIndices.push(current);

  while (visited.size < withCoords.length) {
    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < withCoords.length; i++) {
      if (!visited.has(i) && distMatrix[current][i] < nearestDist) {
        nearestDist = distMatrix[current][i];
        nearestIdx = i;
      }
    }

    if (nearestIdx >= 0) {
      visited.add(nearestIdx);
      optimizedIndices.push(nearestIdx);
      current = nearestIdx;
    } else {
      break;
    }
  }

  // Check if the order actually changed
  const originalOrder = withCoords.map((_, i) => i);
  const orderChanged = optimizedIndices.some((val, idx) => val !== originalOrder[idx]);

  const optimizedWithCoords = optimizedIndices.map(i => withCoords[i]);

  // Calculate improvement
  let originalDist = 0;
  let optimizedDist = 0;
  for (let i = 1; i < withCoords.length; i++) {
    originalDist += distMatrix[i - 1][i];
  }
  for (let i = 1; i < optimizedIndices.length; i++) {
    optimizedDist += distMatrix[optimizedIndices[i - 1]][optimizedIndices[i]];
  }
  const improvement = originalDist > 0 ? ((originalDist - optimizedDist) / originalDist * 100).toFixed(1) : '0';
  console.log(`[optimize-itinerary] Route optimized: ${improvement}% distance reduction, order changed: ${orderChanged}`);

  // Reconstruct the unlocked list: optimized-with-coords + without-coords in their original relative positions
  // Strategy: Build a new unlocked array where coord-having activities are replaced by optimized order,
  // and coord-less activities stay at their original positions among unlocked items.
  const newUnlocked: Activity[] = [];
  let coordIdx = 0;
  for (const act of unlocked) {
    if (getCoordinates(act.location) !== null) {
      newUnlocked.push(optimizedWithCoords[coordIdx++]);
    } else {
      newUnlocked.push(act);
    }
  }

  // Merge locked activities back at their original positions
  const result: Activity[] = [];
  let unlockedIdx = 0;

  for (let i = 0; i < activities.length; i++) {
    const lockedItem = lockedWithIndex.find(l => l.idx === i);
    if (lockedItem) {
      result.push(lockedItem.act);
    } else if (unlockedIdx < newUnlocked.length) {
      result.push(newUnlocked[unlockedIdx++]);
    }
  }

  while (unlockedIdx < newUnlocked.length) {
    result.push(newUnlocked[unlockedIdx++]);
  }

  return { activities: result, changed: orderChanged };
}

// =============================================================================
// ALGORITHM 6: GOOGLE DISTANCE MATRIX API
// Real transport times with automatic mode selection
// =============================================================================

interface TransportResult {
  method: string;
  duration: string;
  durationMinutes: number;
  distance: string;
  distanceMeters: number;
  estimatedCost: { amount: number; currency: string };
  instructions: string;
}

type GoogleLocationInput = { lat: number; lng: number } | string;

function toGoogleParam(loc: GoogleLocationInput): string {
  return typeof loc === 'string' ? encodeURIComponent(loc) : `${loc.lat},${loc.lng}`;
}

function metersToDistanceText(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters)) return '';
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)}m`;
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function parseGoogleDurationToMinutes(duration: any): number {
  // Routes API returns google.protobuf.Duration as a string like "123s".
  if (typeof duration === 'string') {
    const seconds = Number(duration.replace('s', ''));
    return Number.isFinite(seconds) ? Math.round(seconds / 60) : 0;
  }

  // Some APIs return { seconds, nanos }
  const seconds = Number(duration?.seconds);
  if (Number.isFinite(seconds)) return Math.round(seconds / 60);

  return 0;
}

// Extract transit details from Google Directions API response
function extractTransitDetails(steps: any[]): { lines: string[]; summary: string } {
  const transitSteps = steps.filter((s: any) => (s.travel_mode || s.travelMode) === 'TRANSIT');
  const lines: string[] = [];
  
  for (const step of transitSteps) {
    // Supports both legacy Directions API (snake_case) and Routes API (camelCase)
    const transit = step.transit_details || step.transitDetails;
    if (!transit) continue;
    
    const lineName =
      transit.line?.short_name ||
      transit.line?.name ||
      transit.transitLine?.nameShort ||
      transit.transitLine?.name ||
      '';

    const vehicleType =
      transit.line?.vehicle?.type ||
      transit.transitLine?.vehicle?.type ||
      'TRANSIT';

    const departureStop =
      transit.departure_stop?.name ||
      transit.stopDetails?.departureStop?.name ||
      '';

    const arrivalStop =
      transit.arrival_stop?.name ||
      transit.stopDetails?.arrivalStop?.name ||
      '';

    const numStops = transit.num_stops || transit.stopCount || 0;
    
    // Format: "Take M1 Metro from Gare du Nord to Châtelet (4 stops)"
    const vehicleLabel = vehicleType === 'SUBWAY' || vehicleType === 'METRO' ? 'Metro' 
      : vehicleType === 'TRAM' ? 'Tram'
      : vehicleType === 'BUS' ? 'Bus'
      : vehicleType === 'RAIL' || vehicleType === 'HEAVY_RAIL' ? 'Train'
      : vehicleType === 'COMMUTER_TRAIN' ? 'Commuter Train'
      : 'Transit';
    
    const lineLabel = lineName ? `${lineName} ${vehicleLabel}` : vehicleLabel;
    
    if (departureStop && arrivalStop) {
      const stopInfo = numStops > 0 ? ` (${numStops} stop${numStops > 1 ? 's' : ''})` : '';
      lines.push(`Take ${lineLabel} from ${departureStop} to ${arrivalStop}${stopInfo}`);
    } else if (lineName) {
      lines.push(`Take ${lineLabel}`);
    }
  }
  
  return {
    lines,
    summary: lines.length > 0 ? lines.join(' → ') : ''
  };
}

function toRoutesApiLocation(loc: GoogleLocationInput) {
  if (typeof loc === 'string') return { address: loc };
  return { location: { latLng: { latitude: loc.lat, longitude: loc.lng } } };
}

// =============================================================================
// ROUTE CACHE — Avoid redundant Google Routes API calls
// =============================================================================

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );
}

async function getCachedRoute(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  travelMode: string = 'TRANSIT'
): Promise<{
  distanceMeters: number; durationText: string; durationSeconds: number;
  stepsJson: any; transitDetailsJson: any;
} | null> {
  try {
    const cacheKey = `${originLat.toFixed(3)},${originLng.toFixed(3)}→${destLat.toFixed(3)},${destLng.toFixed(3)}:${travelMode}`;
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('route_cache')
      .select('distance_meters, duration_text, duration_seconds, steps_json, transit_details_json, hit_count')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    // Increment hit count (fire and forget)
    sb.from('route_cache').update({ hit_count: (data.hit_count || 0) + 1 }).eq('cache_key', cacheKey).then(() => {});
    console.log(`[Transit] Cache HIT: ${cacheKey}`);
    return {
      distanceMeters: data.distance_meters,
      durationText: data.duration_text,
      durationSeconds: data.duration_seconds,
      stepsJson: data.steps_json,
      transitDetailsJson: data.transit_details_json,
    };
  } catch { return null; }
}

async function setCachedRoute(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  travelMode: string,
  route: { distanceMeters: number; durationText: string; durationSeconds: number; stepsJson: any; transitDetailsJson: any; }
): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from('route_cache').upsert({
      origin_lat: originLat, origin_lng: originLng,
      dest_lat: destLat, dest_lng: destLng,
      travel_mode: travelMode,
      distance_meters: route.distanceMeters,
      duration_text: route.durationText,
      duration_seconds: route.durationSeconds,
      steps_json: route.stepsJson,
      transit_details_json: route.transitDetailsJson,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      hit_count: 0,
    }, { onConflict: 'cache_key' });
  } catch (e) { console.warn('[Transit] Cache write error:', e); }
}

function parseDurationToSeconds(duration: string): number {
  const sMatch = duration.match(/^(\d+)s$/);
  if (sMatch) return parseInt(sMatch[1], 10);
  const minMatch = duration.match(/(\d+)\s*min/);
  if (minMatch) return parseInt(minMatch[1], 10) * 60;
  return 0;
}

function buildInstructionsFromCache(stepsJson: any): string {
  if (!stepsJson || !Array.isArray(stepsJson) || stepsJson.length === 0) return '';
  return stepsJson
    .filter((step: any) => step.transitDetails)
    .map((step: any) => {
      const d = step.transitDetails;
      const line = d?.transitLine?.nameShort || d?.transitLine?.name || '';
      const vehicle = d?.transitLine?.vehicle?.type || '';
      const stops = d?.stopCount || '';
      return `${vehicle} ${line}${stops ? ` (${stops} stops)` : ''}`.trim();
    })
    .filter(Boolean)
    .join(' → ') || '';
}

async function getGoogleRoutesTransitTransport(
  origin: GoogleLocationInput,
  destination: GoogleLocationInput,
  destinationName: string
): Promise<TransportResult | null> {
  // Use dedicated Routes API key if available, fallback to general Maps key
  const apiKey = Deno.env.get("GOOGLE_ROUTES_API_KEY") || Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    console.log('[Transit] (Routes API) No API key available');
    return null;
  }
  try {
    // Check route cache first (only if both are coord-based)
    if (typeof origin !== 'string' && typeof destination !== 'string') {
      const cached = await getCachedRoute(origin.lat, origin.lng, destination.lat, destination.lng, 'TRANSIT');
      if (cached) {
        const durationMinutes = Math.round(cached.durationSeconds / 60);
        const costAmount = Math.min(5, Math.max(2, Math.round(cached.distanceMeters / 5000) + 2));
        const instructions = buildInstructionsFromCache(cached.stepsJson);
        if (instructions) {
          return {
            method: 'metro',
            duration: `${durationMinutes} min`,
            durationMinutes,
            distance: metersToDistanceText(cached.distanceMeters),
            distanceMeters: cached.distanceMeters,
            estimatedCost: { amount: costAmount, currency: 'USD' },
            instructions,
          };
        }
      }
    }

    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const body = {
      origin: toRoutesApiLocation(origin),
      destination: toRoutesApiLocation(destination),
      travelMode: 'TRANSIT',
      computeAlternativeRoutes: false,
      languageCode: 'en-US',
    };

    const fieldMask = [
      'routes.distanceMeters',
      'routes.duration',
      'routes.legs.steps.travelMode',
      'routes.legs.steps.transitDetails',
    ].join(',');

    console.log(`[Transit] (Routes API) Fetching directions for ${destinationName}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      console.log(`[Transit] (Routes API) HTTP ${res.status}: ${msg}`);
      return null;
    }

    const route = data?.routes?.[0];
    const leg = route?.legs?.[0];
    const steps = leg?.steps || [];
    const distanceMeters = Number(route?.distanceMeters ?? leg?.distanceMeters ?? 0);
    const durationMinutes = parseGoogleDurationToMinutes(route?.duration ?? leg?.duration);

    // Extract transit line details
    const transitDetails = extractTransitDetails(steps);
    console.log(`[Transit] (Routes API) Extracted details: ${transitDetails.summary || 'none'}`);

    if (!transitDetails.summary) {
      return null;
    }

    // Cache the successful route (fire and forget)
    if (typeof origin !== 'string' && typeof destination !== 'string') {
      const rawDuration = route?.duration ?? leg?.duration ?? '';
      setCachedRoute(
        origin.lat, origin.lng, destination.lat, destination.lng, 'TRANSIT',
        {
          distanceMeters,
          durationText: `${durationMinutes} min`,
          durationSeconds: parseDurationToSeconds(rawDuration),
          stepsJson: steps,
          transitDetailsJson: steps.filter((s: any) => s.transitDetails),
        }
      ).catch(() => {});
    }

    const costAmount = Math.min(5, Math.max(2, Math.round(distanceMeters / 5000) + 2));

    return {
      method: 'metro',
      duration: `${durationMinutes || 0} min`,
      durationMinutes: durationMinutes || 0,
      distance: metersToDistanceText(distanceMeters),
      distanceMeters: distanceMeters || 0,
      estimatedCost: { amount: costAmount, currency: 'USD' },
      instructions: transitDetails.summary,
    };
  } catch (e) {
    console.log(`[Transit] (Routes API) Error: ${String(e)}`);
    return null;
  }
}

async function getGoogleTransport(
  origin: GoogleLocationInput,
  destination: GoogleLocationInput,
  destinationName: string,
  mode: 'walking' | 'driving' | 'transit' = 'walking'
): Promise<TransportResult | null> {
  const mapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

  // For transit mode, try Routes API first (uses its own key)
  if (mode === 'transit') {
    try {
      // Prefer Routes API (newer, uses dedicated GOOGLE_ROUTES_API_KEY)
      const routesApiResult = await getGoogleRoutesTransitTransport(origin, destination, destinationName);
      if (routesApiResult) return routesApiResult;

      // Fallback to legacy Directions API if we have a Maps key
      if (mapsApiKey) {
        const originParam = toGoogleParam(origin);
        const destParam = toGoogleParam(destination);
        const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originParam}&destination=${destParam}&mode=transit&departure_time=now&key=${mapsApiKey}`;
        console.log(`[Transit] (Legacy Directions) Fetching directions for ${destinationName}`);

        const directionsResponse = await fetch(directionsUrl);
        const directionsData = await directionsResponse.json();

        console.log(`[Transit] (Legacy Directions) API status: ${directionsData.status}`);

        if (directionsData.status === 'OK' && directionsData.routes?.[0]?.legs?.[0]) {
          const leg = directionsData.routes[0].legs[0];
          const distanceMeters = leg.distance.value;
          const durationMinutes = Math.round(leg.duration.value / 60);

          const steps = leg.steps || [];
          console.log(`[Transit] (Legacy Directions) Found ${steps.length} steps, transit steps: ${steps.filter((s: any) => (s.travel_mode || s.travelMode) === 'TRANSIT').length}`);

          const transitDetails = extractTransitDetails(steps);
          console.log(`[Transit] (Legacy Directions) Extracted details: ${transitDetails.summary || 'none'}`);

          const costAmount = Math.min(5, Math.max(2, Math.round(distanceMeters / 5000) + 2));

          let instructions: string;
          if (transitDetails.summary) {
            instructions = transitDetails.summary;
          } else {
            const stepInstructions: string[] = [];
            for (const step of steps) {
              if ((step.travel_mode || step.travelMode) === 'TRANSIT' && step.html_instructions) {
                const cleanInstruction = step.html_instructions.replace(/<[^>]*>/g, '');
                stepInstructions.push(cleanInstruction);
              }
            }
            if (stepInstructions.length > 0) {
              instructions = stepInstructions.join(' → ');
            } else {
              instructions = `Take public transit (${leg.distance.text}) to ${destinationName}`;
            }
          }

          return {
            method: 'metro',
            duration: `${durationMinutes} min`,
            durationMinutes,
            distance: leg.distance.text,
            distanceMeters,
            estimatedCost: { amount: costAmount, currency: 'USD' },
            instructions,
          };
        } else if (directionsData.status === 'ZERO_RESULTS') {
          console.log(`[Transit] (Legacy Directions) No transit routes found`);
        } else {
          console.log(`[Transit] (Legacy Directions) API error: ${directionsData.error_message || directionsData.status}`);
        }
      }
      
      // No transit result available
      return null;
    } catch (error) {
      console.error("[optimize-itinerary] Transit API error:", error);
      return null;
    }
  }

  // For walking/driving modes, use Distance Matrix API (requires Maps key)
  if (!mapsApiKey) {
    return null;
  }

  try {
    // Check route cache for walking/driving (only if both are coord-based)
    const googleMode = mode === 'walking' ? 'WALK' : 'DRIVE';
    if (typeof origin !== 'string' && typeof destination !== 'string') {
      const cached = await getCachedRoute(origin.lat, origin.lng, destination.lat, destination.lng, googleMode);
      if (cached) {
        const durationMinutes = Math.round(cached.durationSeconds / 60);
        let costAmount = 0;
        let displayMethod: string = mode;
        let instructions: string = '';
        if (mode === 'walking') {
          displayMethod = 'walk';
          instructions = `Walk ${metersToDistanceText(cached.distanceMeters)} to ${destinationName}`;
        } else if (mode === 'driving') {
          costAmount = Math.round(3 + (cached.distanceMeters / 1000) * 1.8);
          displayMethod = 'uber';
          instructions = `Take a rideshare ${metersToDistanceText(cached.distanceMeters)} to ${destinationName} (~$${costAmount})`;
        }
        return {
          method: displayMethod, duration: `${durationMinutes} min`, durationMinutes,
          distance: metersToDistanceText(cached.distanceMeters), distanceMeters: cached.distanceMeters,
          estimatedCost: { amount: costAmount, currency: 'USD' }, instructions,
        };
      }
    }

    const originParam = toGoogleParam(origin);
    const destParam = toGoogleParam(destination);
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originParam}&destinations=${destParam}&mode=${mode}&key=${mapsApiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      return null;
    }

    const element = data.rows[0].elements[0];
    if (element.status !== 'OK') {
      return null;
    }

    const distanceMeters = element.distance.value;
    const durationMinutes = Math.round(element.duration.value / 60);

    // Cache the result (fire and forget)
    if (typeof origin !== 'string' && typeof destination !== 'string') {
      setCachedRoute(
        origin.lat, origin.lng, destination.lat, destination.lng, googleMode,
        { distanceMeters, durationText: `${durationMinutes} min`, durationSeconds: element.duration.value, stepsJson: null, transitDetailsJson: null }
      ).catch(() => {});
    }

    let costAmount = 0;
    let displayMethod: string = mode;
    let instructions: string = '';

    if (mode === 'walking') {
      costAmount = 0;
      displayMethod = 'walk';
      instructions = `Walk ${element.distance.text} to ${destinationName}`;
    } else if (mode === 'driving') {
      const basefare = 3;
      const perKmRate = 1.8;
      costAmount = Math.round(basefare + (distanceMeters / 1000) * perKmRate);
      displayMethod = 'uber';
      instructions = `Take a rideshare ${element.distance.text} to ${destinationName} (~$${costAmount})`;
    }

    return {
      method: displayMethod,
      duration: `${durationMinutes} min`,
      durationMinutes,
      distance: element.distance.text,
      distanceMeters,
      estimatedCost: { amount: costAmount, currency: 'USD' },
      instructions,
    };
  } catch (error) {
    console.error("[optimize-itinerary] Google API error:", error);
    return null;
  }
}

// =============================================================================
// TRANSPORT MODE CONSTANTS - Strict limits to prevent unreasonable suggestions
// =============================================================================

// Maximum walking distance: 0.4 miles = ~650 meters
const MAX_WALK_DISTANCE_METERS = 650;
// Maximum walking duration: 15 minutes
const MAX_WALK_DURATION_MINUTES = 15;

// Fallback using Haversine distance estimation with STRICT walking limits
function getHaversineTransport(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  destinationName: string
): TransportResult {
  const distanceMeters = Math.round(getHaversineDistance(
    origin.lat, origin.lng, destination.lat, destination.lng
  ));

  // Determine best mode based on STRICT distance thresholds
  let method: string;
  let durationMinutes: number;
  let costAmount: number;
  let instructions: string;

  // Walking speed: ~5 km/h = 83m/min
  const estimatedWalkMinutes = Math.round(distanceMeters / 83);

  // STRICT: Only walk if under 650m AND under 15 minutes
  if (distanceMeters <= MAX_WALK_DISTANCE_METERS && estimatedWalkMinutes <= MAX_WALK_DURATION_MINUTES) {
    method = 'walk';
    durationMinutes = estimatedWalkMinutes;
    costAmount = 0;
    instructions = `Walk ${Math.round(distanceMeters)}m to ${destinationName}`;
  } else if (distanceMeters < 5000) {
    // 650m-5km = metro/bus (~25 km/h + 5min wait)
    method = 'metro';
    durationMinutes = Math.round(distanceMeters / 417) + 5;
    costAmount = 3;
    instructions = `Take public transit ${(distanceMeters / 1000).toFixed(1)}km to ${destinationName}`;
  } else {
    // Over 5km = rideshare (~30 km/h + 3min pickup)
    method = 'uber';
    durationMinutes = Math.round(distanceMeters / 500) + 3;
    costAmount = Math.round(3 + (distanceMeters / 1000) * 1.8);
    instructions = `Take a rideshare ${(distanceMeters / 1000).toFixed(1)}km to ${destinationName}`;
  }

  const distanceText = distanceMeters < 1000 
    ? `${distanceMeters}m` 
    : `${(distanceMeters / 1000).toFixed(1)}km`;

  return {
    method: method,
    duration: `${durationMinutes} min`,
    durationMinutes,
    distance: distanceText,
    distanceMeters,
    estimatedCost: { amount: costAmount, currency: 'USD' },
    instructions,
  };
}

// Smart transport mode selection
async function getOptimalTransport(
  origin: GoogleLocationInput,
  destination: GoogleLocationInput,
  destinationName: string
): Promise<TransportResult | null> {
  const hasMapsKey = !!Deno.env.get("GOOGLE_MAPS_API_KEY");
  const hasRoutesKey = !!Deno.env.get("GOOGLE_ROUTES_API_KEY");
  const hasAnyKey = hasMapsKey || hasRoutesKey;

  if (!hasAnyKey) {
    console.log(`[Transport] No API keys, falling back to heuristics`);
    // Only possible fallback without Google is Haversine, which needs coords.
    if (typeof origin !== 'string' && typeof destination !== 'string') {
      return getHaversineTransport(origin, destination, destinationName);
    }
    return null;
  }

  // For address-based routing, try transit first since we can't pre-estimate distance
  const isAddressBased = typeof origin === 'string' || typeof destination === 'string';
  
  if (isAddressBased) {
    console.log(`[Transport] Address-based routing to ${destinationName}, trying transit first`);
    // Try transit first for address-based queries
    const transitResult = await getGoogleTransport(origin, destination, destinationName, 'transit');
    if (transitResult) {
      // If transit found and reasonable, use it
      if (transitResult.durationMinutes <= 45) {
        return transitResult;
      }
    }
    
    // Try walking as alternative - STRICT limits (15 min max, ~650m max)
    const walkResult = await getGoogleTransport(origin, destination, destinationName, 'walking');
    const walkDistanceOk = !walkResult?.distanceMeters || walkResult.distanceMeters <= MAX_WALK_DISTANCE_METERS;
    const walkDurationOk = walkResult && walkResult.durationMinutes <= MAX_WALK_DURATION_MINUTES;
    
    if (walkResult && walkDistanceOk && walkDurationOk) {
      return walkResult;
    }
    
    // Try driving for longer distances
    const driveResult = await getGoogleTransport(origin, destination, destinationName, 'driving');
    if (driveResult) {
      return driveResult;
    }
    
    // Return transit if we have it, NOT walk for long distances
    return transitResult || null;
  }

  // For coordinate-based routing, try walking first with STRICT limits
  const walkResult = await getGoogleTransport(origin, destination, destinationName, 'walking');

  if (walkResult) {
    // STRICT: Only allow walking if under 15 minutes AND under ~650m (0.4 miles)
    const walkDistanceOk = !walkResult.distanceMeters || walkResult.distanceMeters <= MAX_WALK_DISTANCE_METERS;
    const walkDurationOk = walkResult.durationMinutes <= MAX_WALK_DURATION_MINUTES;
    
    if (walkDistanceOk && walkDurationOk) {
      return walkResult;
    }

    // Walk is too long - try transit
    const transitResult = await getGoogleTransport(origin, destination, destinationName, 'transit');
    if (transitResult) {
      return transitResult;
    }

    // No transit available - try driving/rideshare
    const driveResult = await getGoogleTransport(origin, destination, destinationName, 'driving');
    if (driveResult) {
      return driveResult;
    }

    // Last resort: return transit placeholder or walk (for very short distances we may have missed)
    if (walkResult.durationMinutes <= MAX_WALK_DURATION_MINUTES) {
      return walkResult;
    }
    
    // If walk is unreasonably long, force to transit with estimated data
    return {
      method: 'metro',
      duration: `${Math.round(walkResult.durationMinutes * 0.4)} min`,
      durationMinutes: Math.round(walkResult.durationMinutes * 0.4),
      distance: walkResult.distance,
      distanceMeters: walkResult.distanceMeters,
      estimatedCost: { amount: 3, currency: 'USD' },
      instructions: `Take public transit to ${destinationName}`,
    };
  }

  // Fallback to Haversine
  if (typeof origin !== 'string' && typeof destination !== 'string') {
    return getHaversineTransport(origin, destination, destinationName);
  }

  return null;
}

// =============================================================================
// ALGORITHM 7: LIGHT & QUICK COST ESTIMATION
// AI should already provide costs - this is just a fallback using category estimates
// No API calls needed - fast and lightweight
// =============================================================================

// Category-based cost estimates (per person, USD)
const CATEGORY_COST_ESTIMATES: Record<string, number> = {
  // Dining categories
  dining: 45,
  restaurant: 50,
  cafe: 15,
  food: 25,
  breakfast: 20,
  lunch: 30,
  dinner: 60,
  // Cultural & sightseeing
  cultural: 20,
  museum: 20,
  sightseeing: 15,
  attraction: 20,
  landmark: 0, // Often free to view externally
  // Activities
  activity: 35,
  tour: 65,
  entertainment: 50,
  show: 75,
  // Shopping & relaxation
  shopping: 0, // Variable, don't estimate
  relaxation: 50,
  spa: 100,
  // Transport & accommodation
  transport: 0,
  accommodation: 0,
};

// Keyword-based adjustments
const KEYWORD_COST_MODIFIERS: Record<string, number> = {
  free: 0,
  'free admission': 0,
  'free entry': 0,
  'free tour': 0,
  luxury: 1.8,
  premium: 1.5,
  upscale: 1.5,
  'fine dining': 2.0,
  budget: 0.6,
  cheap: 0.5,
  casual: 0.7,
};

function estimateCostFromCategory(
  activity: Activity,
  budgetTier?: string
): { amount: number; currency: string } | null {
  const category = (activity.category || activity.type || '').toLowerCase();
  const titleLower = (activity.title || '').toLowerCase();
  const descLower = (activity.description || '').toLowerCase();
  const combined = `${titleLower} ${descLower}`;
  
  // Check for explicit free keywords first
  for (const [keyword, modifier] of Object.entries(KEYWORD_COST_MODIFIERS)) {
    if (combined.includes(keyword) && modifier === 0) {
      return { amount: 0, currency: 'USD' };
    }
  }
  
  // Get base cost from category
  let baseCost = CATEGORY_COST_ESTIMATES[category];
  
  // If no direct match, try to infer from keywords
  if (baseCost === undefined) {
    if (combined.includes('museum') || combined.includes('gallery')) baseCost = 20;
    else if (combined.includes('restaurant') || combined.includes('dinner')) baseCost = 55;
    else if (combined.includes('cafe') || combined.includes('coffee')) baseCost = 12;
    else if (combined.includes('tour') || combined.includes('guided')) baseCost = 60;
    else if (combined.includes('park') || combined.includes('garden')) baseCost = 5;
    else if (combined.includes('market') || combined.includes('shopping')) baseCost = 0;
    else baseCost = 25; // Default fallback
  }
  
  // Apply keyword modifiers
  for (const [keyword, modifier] of Object.entries(KEYWORD_COST_MODIFIERS)) {
    if (combined.includes(keyword) && modifier !== 0) {
      baseCost = Math.round(baseCost * modifier);
      break;
    }
  }
  
  // Apply budget tier scaling
  const tierMultipliers: Record<string, number> = {
    budget: 0.6,
    economy: 0.75,
    standard: 1.0,
    comfort: 1.3,
    premium: 1.6,
    luxury: 2.0,
  };
  
  if (budgetTier && tierMultipliers[budgetTier]) {
    baseCost = Math.round(baseCost * tierMultipliers[budgetTier]);
  }
  
  return baseCost > 0 || combined.includes('free') 
    ? { amount: baseCost, currency: 'USD' } 
    : null;
}

function lightCostEstimation(
  activities: Activity[],
  budgetTier?: string
): Map<string, { amount: number; currency: string }> {
  const results = new Map<string, { amount: number; currency: string }>();
  
  for (const act of activities) {
    // Skip if already has a valid cost from AI
    if (act.cost?.amount !== null && act.cost?.amount !== undefined && act.cost?.amount > 0) {
      continue;
    }
    
    const estimated = estimateCostFromCategory(act, budgetTier);
    if (estimated) {
      results.set(act.id, estimated);
    }
  }
  
  console.log(`[optimize-itinerary] Light cost estimation: filled ${results.size} missing costs (no API calls)`);
  return results;
}

// =============================================================================
// ALGORITHM 8: BUDGET BREAKDOWN CALCULATION
// =============================================================================

interface BudgetBreakdown {
  activities: number;
  food: number;
  transportation: number;
  accommodations: number;
  total: number;
}

function calculateBudgetBreakdown(days: Day[]): BudgetBreakdown {
  let activitiesCost = 0;
  let foodCost = 0;
  let transportationCost = 0;

  for (const day of days) {
    for (const activity of day.activities) {
      const cost = activity.cost?.amount || 0;
      const category = (activity.category || activity.type || '').toLowerCase();

      if (['dining', 'restaurant', 'food', 'cafe'].includes(category)) {
        foodCost += cost;
      } else if (['transport', 'transportation'].includes(category)) {
        // Skip - handled via transportation field
      } else if (!['accommodation', 'downtime', 'relaxation'].includes(category)) {
        activitiesCost += cost;
      }

      // Add inter-activity transportation costs
      if (activity.transportation?.estimatedCost?.amount) {
        transportationCost += activity.transportation.estimatedCost.amount;
      }
    }
  }

  // Estimate accommodations as 40% of subtotal (industry average)
  const subtotal = activitiesCost + foodCost + transportationCost;
  const accommodations = Math.round(subtotal * 0.4);

  return {
    activities: Math.round(activitiesCost),
    food: Math.round(foodCost),
    transportation: Math.round(transportationCost),
    accommodations,
    total: Math.round(subtotal + accommodations),
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
    const body: OptimizeRequest = await req.json();
    const {
      tripId,
      destination,
      days,
      userId,
      currency = 'USD',
      travelers = 1,
      nights = 1,
      preferredDowntimeMinutes,
      maxActivitiesPerDay,
      transportPreferences,
    } = body;

    if (!tripId || !destination || !days || !Array.isArray(days) || days.length === 0) {
      console.error(`[optimize-itinerary] 400: Missing fields - tripId=${!!tripId}, destination=${!!destination}, days=${Array.isArray(days) ? days.length : typeof days}`);
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields: tripId, destination, and days array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract transport preferences with defaults
    const allowedModes = transportPreferences?.allowedModes || ['bus', 'train', 'rideshare', 'taxi', 'walking'];
    const distanceUnit = transportPreferences?.distanceUnit || 'km';
    const useCheapest = allowedModes.includes('cheapest');
    
    console.log(`[optimize-itinerary] Transport prefs: modes=${allowedModes.join(',')}, unit=${distanceUnit}`);

    // Create supabase client for caching and user preferences
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user preferences if userId provided
    let userPrefs: UserItineraryPreferences | null = null;
    if (userId) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('enable_gap_filling, enable_route_optimization, enable_real_transport, enable_geocoding, enable_venue_verification, enable_cost_lookup, preferred_downtime_minutes, max_activities_per_day')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (prefs) {
        userPrefs = prefs as UserItineraryPreferences;
        console.log(`[optimize-itinerary] Loaded user preferences for ${userId}`);
      }
    }

    // Merge request options with user preferences (request overrides user prefs)
    const enableRouteOptimization = body.enableRouteOptimization ?? userPrefs?.enable_route_optimization ?? true;
    const enableRealTransport = body.enableRealTransport ?? userPrefs?.enable_real_transport ?? true;
    const enableCostLookup = body.enableCostLookup ?? userPrefs?.enable_cost_lookup ?? true;
    const enableGapFilling = body.enableGapFilling ?? userPrefs?.enable_gap_filling ?? false;
    const enableTagGeneration = body.enableTagGeneration ?? true;
    const enableGeocoding = body.enableGeocoding ?? userPrefs?.enable_geocoding ?? false;
    const enableVenueVerification = body.enableVenueVerification ?? userPrefs?.enable_venue_verification ?? false;
    const minGapMinutes = preferredDowntimeMinutes ?? userPrefs?.preferred_downtime_minutes ?? 30;

    console.log(`[optimize-itinerary] Processing trip ${tripId}: ${days.length} days, destination: ${destination}`);
    console.log(`[optimize-itinerary] Options: route=${enableRouteOptimization}, transport=${enableRealTransport}, cost=${enableCostLookup}, gaps=${enableGapFilling}, tags=${enableTagGeneration}`);

    const optimizedDays: Day[] = [];
    let totalActivitiesOptimized = 0;
    let routesChanged = 0;
    let transportCalculated = 0;
    let costsLookedUp = 0;
    let gapsInserted = 0;
    let tagsGenerated = 0;
    let geocoded = 0;
    let venuesVerified = 0;

    // Collect all activities for cost estimation
    const allActivities: Activity[] = days.flatMap(d => d.activities);

    // Step 1: Light cost estimation (no API calls - fast!)
    let costLookupResults = new Map<string, { amount: number; currency: string }>();
    if (enableCostLookup) {
      // Use light estimation instead of API-heavy batch lookups
      // AI should already provide costs, this just fills in any gaps
      costLookupResults = lightCostEstimation(allActivities, body.budgetTier);
    }

    for (const day of days) {
      let activities = [...day.activities];

      // Step 2: Try extracting costs from descriptions + generate tags
      activities = activities.map(act => {
        let updated = { ...act };

        // Cost extraction
        if (act.cost?.amount === null || act.cost?.amount === undefined || act.cost?.amount <= 0) {
          // Try cost from lookup results
          if (costLookupResults.has(act.id)) {
            costsLookedUp++;
            updated = { ...updated, cost: costLookupResults.get(act.id)! };
          } else {
            // Try extracting from description
            const extracted = extractCost(act.description, currency);
            if (extracted) {
              costsLookedUp++;
              updated = { ...updated, cost: extracted };
            }
          }
        }

        // Tag generation with caching
        if (enableTagGeneration) {
          const newTags = generateTags(
            act.title,
            act.description,
            act.category,
            act.tags || [],
            updated.cost?.amount,
            act.id // Pass activity ID for caching
          );
          if (newTags.length > (act.tags?.length || 0)) {
            tagsGenerated++;
          }
          updated = { ...updated, tags: newTags };
        }

        return updated;
      });

      // Step 3: Calculate durations
      activities = activities.map((act, idx) => {
        const nextAct = activities[idx + 1];
        const duration = calculateDuration(act.startTime, act.endTime, nextAct?.startTime);
        return { ...act, durationMinutes: duration };
      });

      // Step 4: Geocoding (if enabled and missing coordinates)
      if (enableGeocoding) {
        for (let i = 0; i < activities.length; i++) {
          const act = activities[i];
          if (!getCoordinates(act.location) && act.location?.address) {
            const geo = await geocodeAddress(act.location.address, destination, supabase);
            if (geo) {
              activities[i] = {
                ...act,
                location: {
                  ...act.location,
                  lat: geo.lat,
                  lng: geo.lng,
                  address: geo.formattedAddress,
                },
              };
              geocoded++;
            }
          }
        }
      }

      // Step 5: Venue verification (if enabled)
      if (enableVenueVerification) {
        for (let i = 0; i < activities.length; i++) {
          const act = activities[i];
          // Skip downtime and already verified
          if (act.timeBlockType === 'downtime') continue;
          
          const verification = await verifyVenue(act.title, destination, act.category);
          if (verification.isValid) {
            activities[i] = {
              ...act,
              location: {
                name: act.location?.name || act.title,
                address: verification.formattedAddress || act.location?.address,
                lat: verification.location?.lat || act.location?.lat,
                lng: verification.location?.lng || act.location?.lng,
              },
            };
            venuesVerified++;
          }
        }
      }

      // Step 6: Route optimization
      if (enableRouteOptimization && activities.length > 2) {
        console.log(`[optimize-itinerary] Day ${day.dayNumber}: Optimizing route for ${activities.length} activities`);
        const routeResult = optimizeDayRoute(activities);
        activities = routeResult.activities;
        totalActivitiesOptimized += activities.length;
        if (routeResult.changed) routesChanged++;
      }

      // Step 7: Calculate transportation between activities
      // NOTE: Transportation is attached to the *current* activity, representing how to get to the NEXT activity.
      // This matches the frontend rendering which shows "Transportation to next" under the current row.
      if (enableRealTransport) {
        // Helper: format distance in user's preferred unit
        const formatDistance = (meters: number): string => {
          const km = meters / 1000;
          if (distanceUnit === 'miles') {
            const miles = km * 0.621371;
            return miles < 0.1 
              ? `${Math.round(meters * 3.28084)} ft`
              : `${miles.toFixed(1)} mi`;
          } else {
            return meters < 1000
              ? `${meters}m`
              : `${km.toFixed(1)} km`;
          }
        };

        // Helper: check if a transport mode is allowed by user preferences
        const isModeAllowed = (method: string): boolean => {
          if (useCheapest) return true; // Cheapest ignores mode restrictions
          const modeMap: Record<string, TransportModeOption[]> = {
            walk: ['walking'],
            metro: ['train', 'bus'],
            transit: ['train', 'bus'],
            train: ['train'],
            bus: ['bus'],
            uber: ['rideshare'],
            driving: ['rideshare', 'taxi'],
            taxi: ['taxi'],
          };
          const userModes = modeMap[method.toLowerCase()] || [];
          return userModes.some(m => allowedModes.includes(m));
        };

        const stableHash = (input: string): number => {
          let hash = 0;
          for (let i = 0; i < input.length; i++) {
            hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
          }
          return hash;
        };

        const hashRange = (seed: string, min: number, max: number): number => {
          const span = Math.max(1, max - min + 1);
          return min + (stableHash(seed) % span);
        };

        const estimateNoCoords = (from: Activity, to: Activity, seed: string): TransportData => {
          const fromCat = (from.category || from.type || '').toLowerCase();
          const toCat = (to.category || to.type || '').toLowerCase();
          const destName = to.location?.name || to.title;

          // Check if AI already provided distanceKm in transportation data
          const aiDistanceKm = (from.transportation as any)?.distanceKm || null;
          
          // Estimate distance based on activity categories and context
          let estimatedDistanceKm: number;
          
          const isTransport = (c: string) => ['transport', 'accommodation'].includes(c);
          const isMajor = (c: string) => ['sightseeing', 'cultural', 'museum', 'landmark'].includes(c);
          const isDiningish = (c: string) => ['dining', 'cafe', 'coffee', 'breakfast', 'lunch', 'dinner', 'relaxation'].includes(c);
          const isNightlife = (c: string) => ['nightlife', 'entertainment', 'bar', 'club'].includes(c);
          
          // Use AI-provided distance if available
          if (aiDistanceKm && aiDistanceKm > 0) {
            estimatedDistanceKm = aiDistanceKm;
          }
          // Airport/hotel transfers are typically 15-40km
          else if (isTransport(fromCat) || isTransport(toCat)) {
            estimatedDistanceKm = hashRange(seed, 15, 35) / 10 * 3; // 4.5-10.5km for city, more for airport
            if (from.title?.toLowerCase().includes('airport') || to.title?.toLowerCase().includes('airport')) {
              estimatedDistanceKm = hashRange(seed, 15, 40); // 15-40km for airport transfers
            }
          }
          // Same category attractions may cluster but not always
          else if (isMajor(fromCat) && isMajor(toCat)) {
            estimatedDistanceKm = hashRange(seed, 15, 50) / 10; // 1.5-5km between major sights
          }
          // Dining near attractions is walkable
          else if (isDiningish(toCat) && isMajor(fromCat)) {
            estimatedDistanceKm = hashRange(seed, 3, 12) / 10; // 0.3-1.2km
          }
          // Nightlife tends to cluster in areas
          else if (isNightlife(fromCat) && isNightlife(toCat)) {
            estimatedDistanceKm = hashRange(seed, 5, 15) / 10; // 0.5-1.5km
          }
          // Default: assume moderate urban distance
          else {
            estimatedDistanceKm = hashRange(seed, 15, 40) / 10; // 1.5-4km
          }
          
          // Helper: check if a mode is allowed by user preferences
          const isAllowed = (mode: string): boolean => {
            if (useCheapest) return true; // Cheapest mode ignores restrictions
            const modeMap: Record<string, TransportModeOption[]> = {
              walk: ['walking'],
              metro: ['train', 'bus'],
              train: ['train'],
              bus: ['bus'],
              uber: ['rideshare'],
              taxi: ['taxi'],
            };
            const userModes = modeMap[mode] || [];
            return userModes.some(m => allowedModes.includes(m));
          };

          // Helper: pick best allowed mode from options
          const pickAllowedMode = (
            preferredModes: Array<{ mode: 'walk' | 'metro' | 'uber' | 'taxi' | 'train'; cost: number; durationMins: number; label: string }>
          ): { mode: 'walk' | 'metro' | 'uber' | 'taxi' | 'train'; cost: number; durationMins: number; label: string } | null => {
            // If cheapest mode, sort by cost
            if (useCheapest) {
              const sorted = [...preferredModes].sort((a, b) => a.cost - b.cost);
              return sorted[0] || null;
            }
            // Otherwise, pick first allowed
            for (const opt of preferredModes) {
              if (isAllowed(opt.mode)) return opt;
            }
            // Fallback to walking if nothing else allowed
            if (isAllowed('walk')) {
              return preferredModes.find(m => m.mode === 'walk') || null;
            }
            return preferredModes[0] || null;
          };
          
          // Build mode options based on distance with STRICT walking limits
          // MAX_WALK_DISTANCE_METERS = 650m (0.4 miles), MAX_WALK_DURATION_MINUTES = 15
          const modeOptions: Array<{ mode: 'walk' | 'metro' | 'uber' | 'taxi' | 'train'; cost: number; durationMins: number; label: string }> = [];
          
          const distanceMetersEst = Math.round(estimatedDistanceKm * 1000);
          const walkDuration = Math.round(estimatedDistanceKm * 12); // ~5km/h
          
          // STRICT: Only offer walking if under 650m (0.4 miles) AND under 15 minutes
          const walkDistanceOk = distanceMetersEst <= 650; // MAX_WALK_DISTANCE_METERS
          const walkDurationOk = walkDuration <= 15; // MAX_WALK_DURATION_MINUTES
          
          if (walkDistanceOk && walkDurationOk) {
            modeOptions.push({ mode: 'walk', cost: 0, durationMins: walkDuration, label: 'Walk' });
          }
          
          // Transit is the default for distances over walking threshold
          if (estimatedDistanceKm > 0.65 || !walkDistanceOk) {
            const transitDuration = Math.round(5 + estimatedDistanceKm * 2.5);
            modeOptions.push({ mode: 'metro', cost: 3, durationMins: transitDuration, label: 'Transit' });
          }
          
          // Rideshare/taxi for longer distances (2km+)
          if (estimatedDistanceKm >= 2) {
            const rideShareDuration = Math.round(estimatedDistanceKm * 2);
            const rideShareCost = Math.round(5 + estimatedDistanceKm * 1.5);
            modeOptions.push({ mode: 'uber', cost: rideShareCost, durationMins: rideShareDuration, label: 'Rideshare' });
            
            const taxiCost = Math.round(8 + estimatedDistanceKm * 1.8);
            modeOptions.push({ mode: 'taxi', cost: taxiCost, durationMins: rideShareDuration, label: 'Taxi' });
          }

          // Pick the best allowed mode
          let selected = pickAllowedMode(modeOptions);
          
          // If nothing selected, default to transit (NOT walk for long distances)
          if (!selected) {
            const transitDuration = Math.round(5 + estimatedDistanceKm * 2.5);
            selected = { mode: 'metro', cost: 3, durationMins: transitDuration, label: 'Transit' };
          }
          
          // Apply late night override (safety upgrade to rideshare)
          if (isNightlife(toCat) || (isDiningish(fromCat) && toCat === 'accommodation')) {
            if (selected.mode === 'metro' && estimatedDistanceKm > 2 && isAllowed('uber')) {
              selected = { 
                mode: 'uber', 
                cost: Math.round(8 + estimatedDistanceKm * 1.2), 
                durationMins: Math.round(estimatedDistanceKm * 2),
                label: 'Rideshare (late night)'
              };
            }
          }

          // Format distance based on user's preferred unit
          const distanceMeters = Math.round(estimatedDistanceKm * 1000);
          let distanceText: string;
          if (distanceUnit === 'miles') {
            const miles = estimatedDistanceKm * 0.621371;
            distanceText = miles < 0.1 
              ? `${Math.round(distanceMeters * 3.28084)} ft`
              : `${miles.toFixed(1)} mi`;
          } else {
            distanceText = distanceMeters < 1000
              ? `${distanceMeters}m`
              : `${estimatedDistanceKm.toFixed(1)} km`;
          }
          
          // Build instructions
          let instructions: string;
          if (selected.mode === 'walk') {
            instructions = `${selected.durationMins} minute walk to ${destName}`;
          } else if (selected.mode === 'metro') {
            const fromName = from.location?.name || from.title;
            instructions = `Take public transit from ${fromName} to ${destName} (${distanceText})`;
          } else if (selected.mode === 'uber') {
            instructions = `Take a rideshare to ${destName} (${distanceText}, ~$${selected.cost})`;
          } else if (selected.mode === 'taxi') {
            instructions = `Take a taxi to ${destName} (${distanceText}, ~$${selected.cost})`;
          } else {
            instructions = `${selected.label} to ${destName} (${distanceText})`;
          }

          return {
            method: selected.mode,
            duration: `${selected.durationMins} min`,
            durationMinutes: selected.durationMins,
            distance: distanceText,
            distanceMeters,
            estimatedCost: { amount: selected.cost, currency: 'USD' },
            instructions,
          };
        };

        for (let i = 0; i < activities.length - 1; i++) {
          const from = activities[i];

          // IMPORTANT: Prevent stale/invalid transport from persisting.
          // - Downtime blocks should never show transport (they're "Flexible")
          // - Transport blocks (airport transfer, train transfer, etc.) are the transport itself,
          //   so they should not also show "transportation to next".
          const fromCategory = (from.category || from.type || '').toLowerCase();
          const fromTitle = (from.title || '').toLowerCase();
          const isDowntime = from.timeBlockType === 'downtime';
          
          // Transport blocks ARE transport - don't add route to them
          const isTransportBlock =
            fromCategory === 'transport' ||
            fromCategory === 'transportation' ||
            from.timeBlockType === 'transport' ||
            fromTitle.includes('transfer');

          // Note: Hotel/accommodation blocks SHOULD have routes to next activity
          // Only skip for downtime and pure transport blocks
          if (isDowntime || isTransportBlock) {
            // Clear any pre-existing transport that might be left over from prior runs.
            if (from.transportation) {
              activities[i] = { ...from, transportation: undefined };
            }
            continue;
          }

          // Find next non-downtime activity (so transport doesn't point to "Flexible")
          let nextIndex = i + 1;
          while (nextIndex < activities.length && activities[nextIndex].timeBlockType === 'downtime') {
            nextIndex++;
          }
          if (nextIndex >= activities.length) continue;

          const to = activities[nextIndex];

          // SMART CHECK: If the NEXT activity is itself a transport/transfer block,
          // we don't need to show "transportation to next" - that would be redundant.
          const toCategory = (to.category || to.type || '').toLowerCase();
          const toTitle = (to.title || '').toLowerCase();
          const isNextTransportBlock =
            toCategory === 'transport' ||
            toCategory === 'transportation' ||
            to.timeBlockType === 'transport' ||
            toTitle.includes('transfer') ||
            toTitle.includes('taxi') ||
            toTitle.includes('uber') ||
            toTitle.includes('shuttle');

          if (isNextTransportBlock) {
            // Clear any existing transport - the next card IS the transport
            if (from.transportation) {
              activities[i] = { ...from, transportation: undefined };
            }
            console.log(`[optimize-itinerary] Skipping transport for "${from.title}" → "${to.title}" (next activity is transport)`);
            continue;
          }

          // Leg-level fault isolation: wrap each leg in try/catch so one bad segment
          // doesn't crash the entire optimization
          try {
            const originCoords = getCoordinates(from.location);
            const destCoords = getCoordinates(to.location);

            const seed = `${tripId}|day:${day.dayNumber}|from:${from.id}|to:${to.id}`;

            // Prefer real routing when possible:
            // 1) coords -> best
            // 2) address strings -> still lets Directions API return transit line + stop details
            // 3) activity title + destination as last-resort address for transit details
            let originRouting: GoogleLocationInput | null = originCoords || getRoutingAddress(from.location, destination);
            let destRouting: GoogleLocationInput | null = destCoords || getRoutingAddress(to.location, destination);

            // Last-resort: use activity title + destination city as an address query
            if (!originRouting) {
              const fromTitleAddr = from.location?.name || from.title;
              if (fromTitleAddr) {
                originRouting = `${fromTitleAddr}, ${destination}`;
                console.log(`[optimize-itinerary] Using title-based address for origin: "${originRouting}"`);
              }
            }
            if (!destRouting) {
              const toTitleAddr = to.location?.name || to.title;
              if (toTitleAddr) {
                destRouting = `${toTitleAddr}, ${destination}`;
                console.log(`[optimize-itinerary] Using title-based address for dest: "${destRouting}"`);
              }
            }

            if (originRouting && destRouting) {
              const transport = await getOptimalTransport(originRouting, destRouting, to.location?.name || to.title);

              if (!transport) {
                activities[i] = {
                  ...from,
                  transportation: estimateNoCoords(from, to, seed),
                };
                transportCalculated++;
                console.log(`[optimize-itinerary] No route data for leg "${from.title}" → "${to.title}", using estimated transport`);
              } else {
                // Check if the returned mode is allowed by user preferences
                if (!isModeAllowed(transport.method)) {
                  console.log(`[optimize-itinerary] Mode "${transport.method}" not allowed for leg "${from.title}" → "${to.title}", using estimated transport`);
                  activities[i] = {
                    ...from,
                    transportation: estimateNoCoords(from, to, seed),
                  };
                  transportCalculated++;
                } else {
                  // Format distance in user's preferred unit
                  const formattedDistance = transport.distanceMeters 
                    ? formatDistance(transport.distanceMeters)
                    : transport.distance;

                  activities[i] = {
                    ...from,
                    transportation: {
                      method: transport.method,
                      duration: transport.duration,
                      durationMinutes: transport.durationMinutes,
                      distance: formattedDistance,
                      distanceMeters: transport.distanceMeters,
                      estimatedCost: transport.estimatedCost,
                      instructions: transport.instructions,
                    },
                  };
                  transportCalculated++;
                }
              }
            } else {
              activities[i] = {
                ...from,
                transportation: estimateNoCoords(from, to, seed),
              };
              transportCalculated++;
              console.log(`[optimize-itinerary] No routing info at all for leg "${from.title}" → "${to.title}", using estimated transport`);
            }

            // Safety: walking is always free, regardless of data source (INSIDE loop, not after)
            const finalMethod = (activities[i].transportation?.method || '').toLowerCase();
            if ((finalMethod === 'walk' || finalMethod === 'walking') && activities[i].transportation?.estimatedCost) {
              activities[i] = {
                ...activities[i],
                transportation: {
                  ...activities[i].transportation!,
                  estimatedCost: { amount: 0, currency: activities[i].transportation!.estimatedCost?.currency || 'USD' },
                },
              };
            }
          } catch (legErr) {
            // Fault isolation: log and fall back to estimated transport for this leg
            console.warn(`[optimize-itinerary] Leg error "${from.title}" → "${to.title}":`, legErr instanceof Error ? legErr.message : legErr);
            const seed = `${tripId}|day:${day.dayNumber}|from:${from.id}|to:${to.id}`;
            activities[i] = {
              ...from,
              transportation: estimateNoCoords(from, to, seed),
            };
            transportCalculated++;
          }
        }
      }

      // Step 8: Photo enrichment - REMOVED per user feedback (unreliable, expensive)

      // Step 9: Gap filling
      if (enableGapFilling) {
        const beforeCount = activities.length;
        activities = fillGaps(activities, minGapMinutes);
        gapsInserted += activities.length - beforeCount;
      }

      // Step 9.5: Strip any duplicate activities (safety net)
      const beforeDedup = activities.length;
      const seenTitles = new Set<string>();
      activities = activities.filter(act => {
        const cat = (act.category || act.type || '').toLowerCase();
        if (['transport', 'accommodation', 'downtime', 'free_time'].includes(cat) || act.timeBlockType === 'downtime') {
          return true;
        }
        const key = (act.title || '').toLowerCase().trim();
        if (key.length > 5 && seenTitles.has(key)) {
          console.warn(`[optimize-itinerary] Removed duplicate: "${act.title}"`);
          return false;
        }
        if (key.length > 5) seenTitles.add(key);
        return true;
      });
      if (activities.length < beforeDedup) {
        console.log(`[optimize-itinerary] Dedup removed ${beforeDedup - activities.length} duplicate(s) on day ${day.dayNumber}`);
      }

      // Step 10: Calculate day metadata
      const realActivities = activities.filter(a => a.timeBlockType !== 'downtime');
      const totalDayCost = activities.reduce((sum, a) => {
        const actCost = a.cost?.amount || 0;
        const transportCost = a.transportation?.estimatedCost?.amount || 0;
        return sum + actCost + transportCost;
      }, 0);

      const pacingLevel = calculatePacingLevel(realActivities.length);

      optimizedDays.push({
        ...day,
        activities,
        metadata: {
          ...day.metadata,
          totalEstimatedCost: Math.round(totalDayCost),
          pacingLevel,
          theme: day.title || day.metadata?.theme,
        },
      });
    }

    // Calculate overall budget breakdown
    const budgetBreakdown = calculateBudgetBreakdown(optimizedDays);

    console.log(`[optimize-itinerary] Complete:
      - Routes changed: ${routesChanged} days reordered
      - Route optimized: ${totalActivitiesOptimized} activities
      - Transport calculated: ${transportCalculated} legs
      - Costs looked up: ${costsLookedUp}
      - Tags generated: ${tagsGenerated}
      - Geocoded: ${geocoded}
      - Venues verified: ${venuesVerified}
      - Gaps filled: ${gapsInserted}
      - Budget total: $${budgetBreakdown.total}`);

    // Save to database (reuse existing supabase client)

    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .single();

    if (fetchError) {
      console.error("[optimize-itinerary] Failed to fetch trip:", fetchError);
    } else {
      const existingData = (trip?.itinerary_data as Record<string, unknown>) || {};
      const updatedData = {
        ...existingData,
        days: optimizedDays,
        optimizedAt: new Date().toISOString(),
        budgetBreakdown,
        optimizationMetadata: {
          routeOptimized: enableRouteOptimization,
          realTransport: enableRealTransport,
          costLookup: enableCostLookup,
          gapFilling: enableGapFilling,
          tagGeneration: enableTagGeneration,
          geocoding: enableGeocoding,
          venueVerification: enableVenueVerification,
          minGapMinutes,
          stats: {
            activitiesOptimized: totalActivitiesOptimized,
            routesChanged,
            transportCalculated,
            costsLookedUp,
            tagsGenerated,
            geocoded,
            venuesVerified,
            gapsInserted,
          },
        },
      };

      const { error: updateError } = await supabase
        .from('trips')
        .update({
          itinerary_data: updatedData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      if (updateError) {
        console.error("[optimize-itinerary] Failed to save optimized itinerary:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tripId,
        days: optimizedDays,
        budgetBreakdown,
        metadata: {
          routeOptimized: enableRouteOptimization,
          realTransport: enableRealTransport,
          costLookup: enableCostLookup,
          gapFilling: enableGapFilling,
          tagGeneration: enableTagGeneration,
          geocoding: enableGeocoding,
          venueVerification: enableVenueVerification,
          minGapMinutes,
          stats: {
            activitiesOptimized: totalActivitiesOptimized,
            routesChanged,
            transportCalculated,
            costsLookedUp,
            tagsGenerated,
            geocoded,
            venuesVerified,
            gapsInserted,
          },
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    // Probabilistic cache cleanup (~10% of requests)
    if (Math.random() < 0.1) {
      getSupabaseAdmin()
        .from('route_cache')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .then(({ count }: any) => {
          if (count && count > 0) console.log(`[Route Cache] Cleaned up ${count} expired entries`);
        })
        .catch(() => {});
    }

  } catch (error) {
    console.error("[optimize-itinerary] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
