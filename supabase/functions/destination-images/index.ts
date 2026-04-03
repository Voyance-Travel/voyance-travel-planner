import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { getCachedPhotoUrl } from "../_shared/photo-storage.ts";
import { trackCost } from "../_shared/cost-tracker.ts";
import { checkVenueCache, cacheVenueResult } from "../_shared/venue-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DestinationImage {
  id: string;
  url: string;
  alt: string;
  type: "hero" | "gallery" | "activity";
  source: "curated" | "google_places" | "tripadvisor" | "wikimedia" | "lovable_ai" | "fallback";
  width?: number;
  height?: number;
  attribution?: string;
  placeId?: string;
  photoReference?: string;
  /** Internal: true only when the photo was already cached in storage (no Google photo download). */
  cacheHit?: boolean;
}

interface RequestParams {
  destinationId?: string;
  destination?: string;
  imageType?: string;
  limit?: number;
  venueName?: string; // Specific venue for activity images
  category?: string;  // Activity category for context
  skipCache?: boolean;
}

interface CachedImage {
  id: string;
  entity_type: string;
  entity_key: string;
  destination: string;
  source: string;
  image_url: string;
  thumbnail_url?: string;
  alt_text?: string;
  attribution?: string;
  quality_score?: number;
  photo_reference?: string;
  place_id?: string;
}

// =============================================================================
// TIER 1: CHECK CURATED CACHE
// =============================================================================
async function checkCuratedCache(
  supabase: any,
  entityType: string,
  entityKey: string,
  destination?: string,
  category?: string // NEW: category for mismatch validation
): Promise<DestinationImage | null> {
  try {
    const normalizedKey = entityKey.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").slice(0, 100);
    const cleanName = entityKey.trim().replace(/[^a-zA-Z0-9 ]/g, "");
    const nowIso = new Date().toISOString();

    // --- Attempt 1: exact entity_key match (fast, indexed) ---
    let query = supabase
      .from("curated_images")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_key", normalizedKey)
      .eq("is_blacklisted", false)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

    if (destination) {
      query = query.ilike("destination", `%${destination}%`);
    }

    query = query
      .order("vote_score", { ascending: false, nullsFirst: false })
      .order("quality_score", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    let { data, error } = await query.limit(5);

    // --- Attempt 2: fallback to alt_text fuzzy search (unlocks Place ID-keyed rows) ---
    if ((!data || data.length === 0) && cleanName.length >= 3) {
      console.log(`[Images] No exact entity_key match for "${normalizedKey}", trying alt_text search...`);
      let altQuery = supabase
        .from("curated_images")
        .select("*")
        .eq("entity_type", entityType)
        .eq("is_blacklisted", false)
        .ilike("alt_text", `%${cleanName}%`)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

      if (destination) {
        altQuery = altQuery.ilike("destination", `%${destination}%`);
      }

      altQuery = altQuery
        .order("vote_score", { ascending: false, nullsFirst: false })
        .order("quality_score", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false });

      const altResult = await altQuery.limit(5);
      if (!altResult.error && altResult.data && altResult.data.length > 0) {
        data = altResult.data;
        console.log(`[Images] ✅ alt_text fallback found ${data.length} match(es) for "${cleanName}"`);
      }
    }

    if (error || !data || data.length === 0) {
      return null;
    }

    // Check for negative cache entry (no_result) — skip API calls entirely
    const negativeHit = data.find((row: any) => row.source === 'no_result');
    if (negativeHit) {
      console.log(`[Images] ⛔ Negative cache hit for "${entityKey}" — skipping API calls`);
      return {
        id: `neg-cache-${entityKey}`,
        url: generateCategoryFallbackDataUrl(category || 'activity', entityKey),
        alt: `${entityKey} - fallback`,
        type: entityType === "destination" ? "hero" : "activity",
        source: "fallback",
        width: 1200,
        height: 800,
      };
    }

    // Guardrail: avoid returning airport photos for city-level destination lookups
    // Also apply category mismatch filtering for activity images
    const pick = data.find((row: any) => {
      const alt = String(row.alt_text || "").toLowerCase();
      const key = String(row.entity_key || "").toLowerCase();
      
      // Filter out airport photos for destinations
      if (entityType === "destination") {
        if (alt.includes("airport") || key.includes("airport")) {
          return false;
        }
      }
      
      // NEW: Category mismatch filter for activities
      if (entityType === "activity" && category) {
        if (hasMismatchedContent(category, alt)) {
          console.log(`[Images] Cache entry rejected (content mismatch): ${row.alt_text}`);
          return false;
        }
      }
      
      return true;
    });

    if (!pick) {
      console.log(`[Images] Cache entries found for "${entityKey}" but filtered out (mismatch)`);
      return null;
    }

    console.log(`[Images] ✅ Found cached image for: ${entityKey}`);

    let resolvedUrl = String(pick.image_url || '').trim();

    const isStorageUrl = !!resolvedUrl &&
      !resolvedUrl.startsWith('data:') &&
      resolvedUrl.includes('/storage/v1/object/public/trip-photos/');

    const needsHeal = !!resolvedUrl &&
      !resolvedUrl.startsWith('data:') &&
      !isStorageUrl;

    // Validate existing storage URLs with a HEAD check — purge stale entries
    if (isStorageUrl) {
      try {
        const headResp = await fetch(resolvedUrl, { method: 'HEAD' });
        if (!headResp.ok) {
          console.log(`[Images] ⚠️ Storage URL returned ${headResp.status} for ${entityKey}, purging cache entry`);
          await supabase
            .from('curated_images')
            .delete()
            .eq('id', pick.id);
          return null; // Fall through to fresh fetch
        }
      } catch (headErr) {
        console.warn(`[Images] HEAD check failed for ${entityKey}:`, headErr);
        // On network error, still return the URL — better than nothing
      }
    }

    // Self-heal legacy external URLs by copying once into our storage bucket.
    if (needsHeal) {
      let healedToStorage = false;

      try {
        const healEntityType: 'destination' | 'activity' = entityType === 'destination' ? 'destination' : 'activity';
        const healEntityId = String(pick.place_id || normalizedKey || entityKey)
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .slice(0, 80);

        const healed = await getCachedPhotoUrl(healEntityType, healEntityId, resolvedUrl, {
          destination: destination || pick.destination,
          placeName: pick.alt_text || entityKey,
          placeId: pick.place_id,
        });

        if (healed.source === 'storage') {
          healedToStorage = true;
          resolvedUrl = healed.url;
          await supabase
            .from('curated_images')
            .update({ image_url: resolvedUrl, updated_at: new Date().toISOString() })
            .eq('id', pick.id);
          console.log(`[Images] ♻️ Healed cached URL for: ${entityKey}`);
        }
      } catch (healError) {
        console.warn('[Images] Cache heal skipped:', healError);
      }

      // If we couldn't heal this legacy external URL, bypass cache and fetch a fresh image.
      if (!healedToStorage) {
        console.log(`[Images] Cached URL could not be healed for ${entityKey}, bypassing cache`);
        return null;
      }
    }

    return {
      id: pick.id,
      url: resolvedUrl || pick.image_url,
      alt: pick.alt_text || `${entityKey} photo`,
      type: entityType === "destination" ? "hero" : "activity",
      source: "curated",
      attribution: pick.attribution,
      placeId: pick.place_id,
      photoReference: pick.photo_reference,
    };
  } catch (e) {
    console.error("[Images] Cache check error:", e);
    return null;
  }
}

// =============================================================================
// TIER 2: GOOGLE PLACES PHOTOS (New Places API v1)
// =============================================================================
// =============================================================================
// GUARDRAILS & MATCHING HELPERS
// =============================================================================

// Tokens we consider "noise" (articles, prepositions, etc.)
const NOISE_WORDS = new Set(['the', 'a', 'an', 'of', 'at', 'in', 'to', 'for', 'and', 'or', 'on', 'by', 'with']);

// Bad place types that should never match
const BAD_PLACE_TYPES = new Set([
  'airport', 'transit_station', 'train_station', 'bus_station', 'light_rail_station',
  'subway_station', 'taxi_stand', 'car_rental', 'gas_station', 'parking', 'atm',
  'bank', 'hospital', 'pharmacy', 'police', 'post_office', 'courthouse', 'embassy',
  'local_government_office', 'insurance_agency', 'real_estate_agency'
]);

// Keywords in display name / address that indicate a bad match
const BAD_KEYWORDS = [
  'airport', 'terminal', 'arrivals', 'departures', 'gate ', 'concourse',
  'train station', 'bus station', 'metro station', 'subway', 'parking lot',
  'gas station', 'petrol', 'atm', 'bank branch'
];

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length >= 3 && !NOISE_WORDS.has(t));
}

function isBadPlaceByType(types: string[]): boolean {
  const joined = types.join(' ').toLowerCase();
  for (const bad of BAD_PLACE_TYPES) {
    if (joined.includes(bad)) return true;
  }
  return false;
}

function isBadPlaceByKeyword(displayName: string, address?: string): boolean {
  const combined = `${displayName} ${address || ''}`.toLowerCase();
  for (const kw of BAD_KEYWORDS) {
    if (combined.includes(kw)) return true;
  }
  return false;
}

/**
 * Calculate a similarity score between venue query and Google result.
 * Returns 0-1 where higher is better.
 */
function calculateMatchScore(venueTokens: Set<string>, displayName: string): number {
  const nameTokens = tokenize(displayName);
  if (nameTokens.length === 0 || venueTokens.size === 0) return 0.5; // neutral if can't compare

  let matches = 0;
  for (const t of nameTokens) {
    if (venueTokens.has(t)) matches++;
  }

  // Score based on how many query tokens appear in the result
  const coverage = matches / venueTokens.size;

  // Bonus if the result also contains most of its own tokens in the query
  const reverseMatches = nameTokens.filter(t => venueTokens.has(t)).length;
  const reverseCoverage = reverseMatches / nameTokens.length;

  return (coverage * 0.7) + (reverseCoverage * 0.3);
}

// =============================================================================
// CONTENT MISMATCH DETECTION (Layer 3: Quality Assurance)
// =============================================================================
// Keywords that indicate a mismatch between activity category and image content
const CATEGORY_MISMATCH_KEYWORDS: Record<string, string[]> = {
  'dining': ['yoga', 'sumo', 'canyon', 'hiking', 'pool', 'swimming', 'wrestling', 'gym', 'airport', 'train station'],
  'breakfast': ['yoga', 'sumo', 'canyon', 'hiking', 'tour', 'wrestling', 'gym', 'airport', 'train station'],
  'lunch': ['yoga', 'sumo', 'canyon', 'hiking', 'tour', 'wrestling', 'gym', 'airport', 'train station'],
  'dinner': ['yoga', 'sumo', 'canyon', 'hiking', 'tour', 'wrestling', 'gym', 'airport', 'train station'],
  'brunch': ['yoga', 'sumo', 'canyon', 'hiking', 'tour', 'wrestling', 'gym', 'airport', 'train station'],
  'accommodation': ['sumo', 'canyon', 'hiking', 'wrestling', 'restaurant', 'cafe', 'yoga studio', 'airport'],
  'hotel': ['sumo', 'canyon', 'hiking', 'wrestling', 'restaurant', 'cafe', 'yoga studio', 'airport'],
  'cafe': ['sumo', 'canyon', 'hiking', 'wrestling', 'gym', 'yoga studio', 'airport', 'train station'],
  'coffee': ['sumo', 'canyon', 'hiking', 'wrestling', 'gym', 'yoga studio', 'airport', 'train station'],
  'museum': ['yoga', 'sumo', 'canyon', 'hiking', 'pool', 'swimming', 'wrestling', 'gym', 'restaurant'],
  'cultural': ['yoga studio', 'sumo', 'canyon', 'pool', 'swimming', 'gym'],
  'spa': ['sumo', 'canyon', 'hiking', 'wrestling', 'airport', 'train station', 'restaurant'],
  'relaxation': ['sumo', 'canyon', 'hiking', 'wrestling', 'airport', 'train station'],
  'sightseeing': ['yoga studio', 'sumo wrestling', 'gym', 'pool', 'swimming pool'],
};

/**
 * Detect if image content (alt text / display name) contains keywords 
 * that don't make sense for the requested category.
 * Returns true if there's a mismatch (image should be rejected).
 */
function hasMismatchedContent(category: string, altTextOrName: string): boolean {
  if (!category || !altTextOrName) return false;
  
  const cat = category.toLowerCase();
  const text = altTextOrName.toLowerCase();
  
  for (const [catKey, forbidden] of Object.entries(CATEGORY_MISMATCH_KEYWORDS)) {
    if (cat.includes(catKey)) {
      for (const kw of forbidden) {
        if (text.includes(kw)) {
          console.log(`[Images] Content mismatch detected: category="${cat}", found forbidden keyword="${kw}" in "${altTextOrName}"`);
          return true;
        }
      }
    }
  }
  return false;
}

// =============================================================================
// TIER 2: GOOGLE PLACES PHOTOS (New Places API v1) - HARDENED
// =============================================================================
async function getGooglePlacesPhoto(
  entityType: 'activity' | 'destination',
  venueName: string,
  destination: string,
  apiKey: string,
  category?: string
): Promise<DestinationImage | null> {
  try {
    const cat = (category || '').toLowerCase();

    // For dining, use "restaurant" hint; for landmarks, use "landmark" etc.
    const isDining = cat.includes('dining') || cat.includes('lunch') || cat.includes('dinner') ||
                     cat.includes('breakfast') || cat.includes('brunch') || cat.includes('cafe') ||
                     cat.includes('restaurant') || cat.includes('food');
    const isMuseum = cat.includes('museum') || cat.includes('cultural') || cat.includes('gallery');
    const isSpa = cat.includes('spa') || cat.includes('relaxation') || cat.includes('recharge') || cat.includes('wellness');
    const isSightseeing = cat.includes('sightseeing') || cat.includes('landmark') || cat.includes('attraction');

    const hint = isDining ? 'restaurant' : isMuseum ? 'museum' : isSpa ? 'spa wellness' : isSightseeing ? 'landmark attraction' : '';

    // Build query: for dining we want "Restaurant Name restaurant Rome" to bias toward food
    const textQuery = hint
      ? `${venueName} ${hint} ${destination}`
      : `${venueName} ${destination}`;

    console.log("[Images] Searching Google Places (v1) for:", textQuery, `[category=${category}]`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const venueTokens = new Set(tokenize(venueName));

    // Minimum match threshold (0-1): require at least 55% token overlap (raised from 0.50)
    const MIN_MATCH_SCORE = 0.55;

    try {
      const searchResponse = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.photos,places.types,places.formattedAddress",
          },
          body: JSON.stringify({
            textQuery,
            maxResultCount: 8, // request more so we can filter
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error("[Images] Google Places v1 error:", searchResponse.status, errorText);
        return null;
      }

      const searchData = await searchResponse.json();
      const places = searchData.places || [];

      console.log("[Images] Google Places v1 returned", places.length, "results");

      if (places.length === 0) {
        console.log("[Images] No Google Places v1 results for:", textQuery);
        return null;
      }

      // Score and filter candidates
      type ScoredPlace = { place: any; score: number };
      const scored: ScoredPlace[] = [];

      for (const p of places) {
        if (!p?.photos?.length) continue;

        const types: string[] = Array.isArray(p?.types) ? p.types : [];
        const displayName = p?.displayName?.text || '';
        const address = p?.formattedAddress || '';

        // Hard reject bad place types
        if (isBadPlaceByType(types)) {
          console.log("[Images] Rejecting (bad type):", displayName);
          continue;
        }

        // Hard reject bad keywords
        if (isBadPlaceByKeyword(displayName, address)) {
          console.log("[Images] Rejecting (bad keyword):", displayName);
          continue;
        }

        // Calculate match score
        const score = calculateMatchScore(venueTokens, displayName);

        if (score < MIN_MATCH_SCORE) {
          console.log(`[Images] Rejecting (low score ${score.toFixed(2)}):`, displayName);
          continue;
        }

        // NEW: Content mismatch filter - reject if image content doesn't match category
        if (category && hasMismatchedContent(category, displayName)) {
          console.log(`[Images] Rejecting (content mismatch):`, displayName);
          continue;
        }

        // Bonus for matching category type
        let typeBonus = 0;
        const typesJoined = types.join(' ').toLowerCase();
        if (isDining && typesJoined.includes('restaurant')) typeBonus = 0.15;
        if (isMuseum && typesJoined.includes('museum')) typeBonus = 0.15;
        if (isSpa && (typesJoined.includes('spa') || typesJoined.includes('beauty'))) typeBonus = 0.15;

        scored.push({ place: p, score: score + typeBonus });
      }

      if (scored.length === 0) {
        console.log("[Images] No suitable photos after filtering for:", textQuery);
        return null;
      }

      // Sort by score descending and pick best
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];

      // If best score is still weak, skip to fallback
      if (best.score < 0.6) {
        console.log(`[Images] Best match score too low (${best.score.toFixed(2)}), falling back`);
        return null;
      }

      console.log(`[Images] ✅ Best match (score ${best.score.toFixed(2)}):`, best.place.displayName?.text);

      // Pick the best photo from the place (prefer 2nd or 3rd photo — first is often a logo/sign)
      const photos = best.place.photos || [];
      // Skip first photo (often logo/sign) and second (often interior/staff).
      // Prefer third photo which tends to be exterior/ambiance.
      const photoIndex = photos.length >= 4 ? 2 : photos.length >= 2 ? 1 : 0;
      const photoResource = photos[photoIndex].name;
      const googlePhotoUrl = `https://places.googleapis.com/v1/${photoResource}/media?maxWidthPx=1200&key=${apiKey}`;
      
      // Download to Supabase Storage to avoid repeated API calls
      const cacheResult = await getCachedPhotoUrl(
        entityType,
        best.place.id,
        googlePhotoUrl,
        { destination, placeName: best.place.displayName?.text || venueName, placeId: best.place.id }
      );

      return {
        id: `google-${entityType}-${best.place.id}`,
        url: cacheResult.url,
        alt: `${best.place.displayName?.text || venueName} - Photo`,
        type: entityType === 'destination' ? 'hero' : 'activity',
        source: "google_places",
        width: 1200,
        height: 800,
        placeId: best.place.id,
        photoReference: photoResource,
        cacheHit: cacheResult.cacheHit,
      };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.log("[Images] Google Places v1 timeout (4s) for:", textQuery);
      } else {
        console.error("[Images] Google Places v1 fetch error:", fetchError);
      }
      return null;
    }
  } catch (error) {
    console.error("[Images] Google Places v1 error:", error);
    return null;
  }
}

// =============================================================================
// TIER 3: TRIPADVISOR PHOTOS
// =============================================================================
async function getTripAdvisorPhoto(
  venueName: string,
  destination: string,
  apiKey: string
): Promise<DestinationImage | null> {
  try {
    // Step 1: Search for location
    const searchQuery = `${venueName} ${destination}`;
    const searchUrl = `https://api.content.tripadvisor.com/api/v1/location/search?key=${apiKey}&searchQuery=${encodeURIComponent(searchQuery)}&language=en`;

    console.log("[Images] Searching TripAdvisor for:", searchQuery);

    const searchResponse = await fetch(searchUrl, {
      headers: { "accept": "application/json" }
    });

    if (!searchResponse.ok) {
      console.log("[Images] TripAdvisor search failed:", searchResponse.status);
      return null;
    }

    const searchData = await searchResponse.json();
    const location = searchData.data?.[0];

    if (!location?.location_id) {
      console.log("[Images] No TripAdvisor location found for:", searchQuery);
      return null;
    }

    // NEW: Validate the result matches our query (same logic as Google Places)
    const venueTokens = new Set(tokenize(venueName));
    const locationName = location.name || '';
    const matchScore = calculateMatchScore(venueTokens, locationName);
    
    // Match threshold for TripAdvisor (raised from 0.45 to 0.55)
    const MIN_MATCH_SCORE = 0.55;
    
    if (matchScore < MIN_MATCH_SCORE) {
      console.log(`[Images] Rejecting TripAdvisor result (low score ${matchScore.toFixed(2)}): ${locationName}`);
      return null;
    }

    // NEW: Content mismatch filter for TripAdvisor
    // Category is not passed directly to this function, so we use a broad check
    // Looking for obviously mismatched content in the location name
    const suspiciousMismatches = ['yoga studio', 'sumo wrestling', 'gym', 'fitness center', 'airport'];
    const lowerName = locationName.toLowerCase();
    for (const mismatch of suspiciousMismatches) {
      if (lowerName.includes(mismatch) && !venueName.toLowerCase().includes(mismatch.split(' ')[0])) {
        console.log(`[Images] Rejecting TripAdvisor (content mismatch): ${locationName}`);
        return null;
      }
    }

    // Step 2: Get photos for the location
    const photosUrl = `https://api.content.tripadvisor.com/api/v1/location/${location.location_id}/photos?key=${apiKey}&language=en`;

    const photosResponse = await fetch(photosUrl, {
      headers: { "accept": "application/json" }
    });

    if (!photosResponse.ok) {
      console.log("[Images] TripAdvisor photos failed:", photosResponse.status);
      return null;
    }

    const photosData = await photosResponse.json();
    const photo = photosData.data?.[0];

    if (!photo?.images?.large?.url) {
      console.log("[Images] No TripAdvisor photos for:", venueName);
      return null;
    }

    console.log(`[Images] ✅ Found TripAdvisor photo for: ${venueName} (score ${matchScore.toFixed(2)})`);

    return {
      id: `tripadvisor-${location.location_id}`,
      url: photo.images.large.url,
      alt: `${location.name || venueName} - TripAdvisor Photo`,
      type: "activity",
      source: "tripadvisor",
      width: photo.images.large.width || 1200,
      height: photo.images.large.height || 800,
      attribution: photo.user?.username ? `Photo by ${photo.user.username}` : undefined,
    };
  } catch (error) {
    console.error("[Images] TripAdvisor error:", error);
    return null;
  }
}

// =============================================================================
// TIER 4: WIKIMEDIA COMMONS (Free, good for landmarks)
// =============================================================================
async function getWikimediaPhoto(
  venueName: string,
  destination: string
): Promise<DestinationImage | null> {
  try {
    // Search Wikipedia for the venue/landmark
    const searchQuery = `${venueName} ${destination}`;
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=original&titles=${encodeURIComponent(searchQuery)}&origin=*`;

    console.log("[Images] Searching Wikimedia for:", searchQuery);

    const response = await fetch(searchUrl);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const pages = data.query?.pages;
    
    if (!pages) {
      return null;
    }

    // Get the first page with an image
    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      const imageUrl = page.original?.source;
      
      if (imageUrl && !imageUrl.includes('.svg')) {
        console.log("[Images] ✅ Found Wikimedia photo for:", venueName);
        
        return {
          id: `wikimedia-${pageId}`,
          url: imageUrl,
          alt: `${page.title || venueName} - Wikimedia Commons`,
          type: "activity",
          source: "wikimedia",
          width: page.original?.width,
          height: page.original?.height,
          attribution: "Wikimedia Commons - CC BY-SA",
        };
      }
    }

    return null;
  } catch (error) {
    console.error("[Images] Wikimedia error:", error);
    return null;
  }
}

// =============================================================================
// TIER 5: AI GENERATION (Last resort)
// =============================================================================
async function generateAIImage(
  subject: string,
  context: string,
  lovableApiKey: string
): Promise<DestinationImage | null> {
  try {
    console.log("[Images] Generating AI image for:", subject);

    const prompt = `A beautiful, high-quality travel photograph of ${subject} in ${context}. Scenic landmark view, golden hour lighting, professional travel photography, no people, ultra high resolution. 16:9 aspect ratio.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("[Images] AI generation failed:", response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("[Images] No image URL in AI response");
      return null;
    }

    console.log("[Images] ✅ Generated AI image for:", subject);

    return {
      id: `ai-${subject.replace(/\s/g, "-").toLowerCase()}-${Date.now()}`,
      url: imageUrl,
      alt: `${subject} - AI Generated Travel Photo`,
      type: "hero",
      source: "lovable_ai",
      width: 1024,
      height: 1024,
    };
  } catch (error) {
    console.error("[Images] AI generation error:", error);
    return null;
  }
}

// =============================================================================
// AI RANKING: Select best image from candidates
// =============================================================================
async function rankImageCandidates(
  candidates: DestinationImage[],
  subject: string,
  lovableApiKey: string
): Promise<DestinationImage | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  try {
    console.log(`[Images] Ranking ${candidates.length} candidates for: ${subject}`);

    const prompt = `You are an image quality expert for a travel app. Given these image sources for "${subject}", rank them by quality for a travel itinerary.

IMAGE CANDIDATES:
${candidates.map((c, i) => `${i + 1}. Source: ${c.source}, URL: ${c.url.substring(0, 100)}...`).join('\n')}

RANKING CRITERIA (in order of importance):
1. Real photos of the actual venue (not stock photos)
2. Good lighting and composition
3. Shows the landmark/venue clearly
4. No people blocking the view
5. High resolution

Return ONLY the number (1, 2, 3, etc.) of the best image. Just the number, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      console.log("[Images] AI ranking failed, using first candidate");
      return candidates[0];
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    const selectedIndex = parseInt(answer) - 1;

    if (selectedIndex >= 0 && selectedIndex < candidates.length) {
      console.log(`[Images] AI selected candidate ${selectedIndex + 1}: ${candidates[selectedIndex].source}`);
      return candidates[selectedIndex];
    }

    return candidates[0];
  } catch (error) {
    console.error("[Images] AI ranking error:", error);
    return candidates[0];
  }
}

// =============================================================================
// URL STABILIZATION + CACHE RESULT
// =============================================================================
function isTripPhotoStorageUrl(url: string): boolean {
  return url.includes('/storage/v1/object/public/trip-photos/');
}

function shouldPersistInCuratedCache(image: DestinationImage): boolean {
  if (!image.url || image.url.startsWith('data:')) return false;

  const lower = image.url.toLowerCase();

  // Never cache transient/sensitive URLs.
  if (lower.includes('places.googleapis.com')) return false;
  if (lower.includes('x-amz-signature=')) return false;
  if (/[?&]token=/.test(lower)) return false;

  // External providers must be persisted to storage first, otherwise links may break.
  if (
    (image.source === 'lovable_ai' || image.source === 'tripadvisor' || image.source === 'wikimedia' || image.source === 'google_places') &&
    !isTripPhotoStorageUrl(image.url)
  ) {
    return false;
  }

  return true;
}

async function ensurePersistentStorageUrl(
  image: DestinationImage,
  entityType: string,
  entityKey: string,
  destination: string
): Promise<DestinationImage> {
  if (!image.url || image.url.startsWith('data:') || isTripPhotoStorageUrl(image.url)) {
    return image;
  }

  // Normalize removable query params from external CDN links.
  const normalizedUrl = image.url.includes('media-cdn.tripadvisor.com')
    ? image.url.split('?')[0]
    : image.url;

  try {
    const hashSeed = normalizedUrl.split('').reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);
    const stableEntityId = `${entityKey}-${Math.abs(hashSeed).toString(36)}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 80);

    const storageEntityType: 'destination' | 'activity' = entityType === 'destination' ? 'destination' : 'activity';

    const persisted = await getCachedPhotoUrl(storageEntityType, stableEntityId, normalizedUrl, {
      destination,
      placeName: image.alt,
      placeId: image.placeId,
    });

    if (persisted.source === 'storage') {
      return { ...image, url: persisted.url };
    }

    return { ...image, url: normalizedUrl };
  } catch (persistError) {
    console.warn('[Images] Could not persist external image URL:', persistError);
    return { ...image, url: normalizedUrl };
  }
}

async function cacheImage(
  supabase: any,
  entityType: string,
  entityKey: string,
  destination: string,
  image: DestinationImage,
  qualityScore?: number
): Promise<void> {
  try {
    // Never cache transient URLs or inline data URLs.
    if (!shouldPersistInCuratedCache(image)) {
      console.log(`[Images] Skipping cache for transient image URL: ${entityKey}`);
      return;
    }

    // Secondary safety: double-check no raw Google/Places API URLs leak through
    if (image.url.includes('places.googleapis.com') || image.url.includes('maps.googleapis.com')) {
      console.warn(`[Images] BLOCKED raw Google URL from cache: ${entityKey}`);
      return;
    }

    const normalizedKey = entityKey.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').slice(0, 100);

    // Cache images for 60 days then refresh
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from("curated_images").upsert({
      entity_type: entityType,
      entity_key: normalizedKey,
      destination: destination,
      source: image.source,
      image_url: image.url,
      alt_text: image.alt,
      attribution: image.attribution,
      quality_score: qualityScore || 0.8,
      photo_reference: image.photoReference,
      place_id: image.placeId,
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
    }, {
      onConflict: 'entity_type,entity_key,destination'
    });

    console.log(`[Images] Cached image for: ${entityKey}`);
  } catch (e) {
    console.error("[Images] Cache save error:", e);
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Clean activity title to extract searchable venue name
function extractVenueName(activityTitle: string): { cleanName: string; shouldSkip: boolean; inferredCategory?: string } {
  const title = activityTitle.trim();
  
  // Activities that should use category fallback instead of search
  const skipPatterns = [
    /^(afternoon|morning|evening)\s+(siesta|rest|recharge|relaxation|break)/i,
    /^(free\s+time|leisure|downtime|rest\s+day)/i,
    /^(hotel\s+check[\-\s]?(in|out)|check[\-\s]?(in|out)\s+at)/i,
    /^(arrival|departure|transfer|airport)/i,
    /^(pack|unpack|settle\s+in)/i,
    /^(breakfast|lunch|dinner|brunch)\s+(break|time)$/i,
    // Hotel dining activities
    /^(?:relaxed|leisurely|early|late)?\s*(?:morning|afternoon|evening)?\s*(?:and\s+)?(?:breakfast|brunch|lunch|dinner)\s+(?:at\s+)?(?:the\s+)?hotel/i,
    /^(?:breakfast|brunch|lunch|dinner|meal)\s+at\s+(?:the\s+)?(?:hotel|resort|inn|lodge)/i,
    // Generic meal descriptors without a venue name
    /^(?:organic|vegetarian|vegan|local|seasonal|farm[\-\s]?to[\-\s]?table|tasting|traditional|street|authentic|gourmet|artisan|homemade|rustic|contemporary|modern|classic|regional|coastal)\b.*\b(?:breakfast|brunch|lunch|dinner|meal|cuisine|food|fare)\b/i,
    /^(?:breakfast|brunch|lunch|dinner|meal)\b(?!.*\b(?:at|@|:)\b).*/i,
    /^(?:morning|afternoon|evening|late|early)\s+(?:breakfast|brunch|lunch|dinner|meal|snack)/i,
    /^(?:quick|light|leisurely|relaxed|casual|formal)\s+(?:breakfast|brunch|lunch|dinner|meal)/i,
    /^[A-Z][a-z]+\s+(?:cuisine|culinary|gastronomy|food)\s+(?:experience|adventure|exploration|journey|tour)/i,
    // Generic patterns
    /^(?:wander|stroll|walk)\s+(?:around|through|along)/i,
    /^(?:relax|unwind|chill)\s+(?:at\s+the\s+)?(?:hotel|room|pool)/i,
    /^(?:pack\s+up|get\s+ready|prepare)/i,
    // NEW: Catch creative AI-generated generic titles
    /^(?:high[\-\s]?protein|low[\-\s]?carb|healthy|power|energy)\s+(?:fuel|fueling|refuel|breakfast|lunch|meal)/i,
    /^(?:fuel|fueling|refuel)\s+(?:up|station|stop|break)/i,
    /^(?:morning|afternoon|evening|pre[\-\s]?workout|post[\-\s]?workout)\s+(?:fuel|fueling|refuel)/i,
    /^(?:social|group|team|family)\s+(?:dinner|lunch|breakfast|brunch|drinks?|cocktails?|bbq)/i,
    /^(?:romantic|sunset|sunrise|late[\-\s]?night|midnight)\s+(?:dinner|lunch|drinks?|cocktails?|stroll|walk)/i,
    /^(?:power|morning|sunrise|sunset|beach|park|urban)\s+(?:run|jog|sprint|workout|exercise|yoga|stretch)/i,
    /^(?:rooftop|poolside|beachside|garden|terrace)\s+(?:drinks?|cocktails?|dinner|lunch|brunch|chill|vibes?)/i,
    // Catch vague descriptor-only titles (no proper nouns)
    /^(?:hidden|secret|local|authentic|traditional|famous|best|top|favorite|favourite|iconic|legendary|charming|cozy|quaint|trendy|hip|buzzy)\s+(?:spot|gem|find|discovery|eatery|joint|hole[\-\s]?in[\-\s]?the[\-\s]?wall|place|haunt|hangout)$/i,
  ];
  
  for (const pattern of skipPatterns) {
    if (pattern.test(title)) {
      // Infer category from skip pattern for better fallback
      const inferredCat = inferCategoryFromTitle(title);
      return { cleanName: title, shouldSkip: true, inferredCategory: inferredCat };
    }
  }
  
  // SPECIAL: Detect hotel dining activities - extract hotel name and use accommodation category
  const hotelDiningMatch = title.match(/(?:breakfast|brunch|lunch|dinner)\s+(?:at\s+)?(.+?\s+(?:hotel|resort|inn|hyatt|hilton|marriott|sheraton|ritz|intercontinental|four\s+seasons|peninsula|mandarin|waldorf|st\.?\s*regis))/i);
  if (hotelDiningMatch) {
    return { 
      cleanName: hotelDiningMatch[1].trim(), 
      shouldSkip: false, 
      inferredCategory: 'accommodation' // Use hotel category instead of dining
    };
  }
  
  // ENHANCED: Extract venue from more patterns
  const extractPatterns = [
    // Dining patterns
    { pattern: /^(?:dinner|lunch|breakfast|brunch|meal)\s+(?:at|@)\s+(.+)/i, category: 'dining' },
    { pattern: /^(?:coffee|drinks?|cocktails?)\s+(?:at|@)\s+(.+)/i, category: 'cafe' },
    { pattern: /^(?:tasting|wine\s+tasting|food\s+tour)\s+(?:at|@)\s+(.+)/i, category: 'dining' },
    // Accommodation
    { pattern: /^(?:check[\-\s]?in|stay|night)\s+(?:at|@)\s+(.+)/i, category: 'hotel' },
    { pattern: /^(.+?)\s+(?:hotel|resort|inn|hostel|lodge|villa|boutique\s+stay)$/i, category: 'hotel' },
    // Attractions
    { pattern: /^(?:visit|explore|tour|see|experience|discover)\s+(?:the\s+)?(.+)/i, category: 'sightseeing' },
    { pattern: /^(?:hike|trek|climb)\s+(?:to|up|through)\s+(.+)/i, category: 'nature' },
    { pattern: /^(?:swim|snorkel|dive)\s+(?:at|in)\s+(.+)/i, category: 'beach' },
    { pattern: /^(?:shopping|browse|shop)\s+(?:at|@|in)\s+(.+)/i, category: 'shopping' },
    // Reverse patterns
    { pattern: /^(.+?)\s+(?:exploration|experience|tour|visit)$/i, category: 'sightseeing' },
    { pattern: /^(.+?)\s+(?:for\s+(?:dinner|lunch|breakfast))$/i, category: 'dining' },
    { pattern: /^(.+?)\s+(?:museum|gallery|exhibition)$/i, category: 'museum' },
    { pattern: /^(.+?)\s+(?:market|bazaar|souk)$/i, category: 'shopping' },
    { pattern: /^(.+?)\s+(?:temple|shrine|church|cathedral|mosque)$/i, category: 'cultural' },
    { pattern: /^(.+?)\s+(?:park|garden|gardens|beach|waterfall)$/i, category: 'nature' },
    { pattern: /^(.+?)\s+(?:spa|massage|wellness)$/i, category: 'spa' },
  ];
  
  for (const { pattern, category } of extractPatterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Only use if it looks like a proper venue name
      if (extracted.length > 3 && !/^(the|a|an|some|good|local|nearby)$/i.test(extracted)) {
        return { cleanName: extracted, shouldSkip: false, inferredCategory: category };
      }
    }
  }
  
  // Final heuristic: if title has NO proper nouns (no capitalized words after first),
  // it's likely a generic description → use category fallback
  const inferredCat = inferCategoryFromTitle(title);
  const words = title.split(/\s+/).filter(w => w.length > 2);
  const properNouns = words.filter((w, i) => i > 0 && /^[A-Z]/.test(w) && !NOISE_WORDS.has(w.toLowerCase()));
  
  if (properNouns.length === 0 && words.length > 2) {
    // No proper nouns detected — likely "social korean bbq dinner" type title
    console.log(`[Images] No proper nouns in "${title}", using category fallback (${inferredCat})`);
    return { cleanName: title, shouldSkip: true, inferredCategory: inferredCat };
  }
  
  return { cleanName: title, shouldSkip: false, inferredCategory: inferredCat };
}

// NEW: Infer category from keywords in title
function inferCategoryFromTitle(title: string): string {
  const lower = title.toLowerCase();
  
  const categoryKeywords: Record<string, string[]> = {
    dining: ['dinner', 'lunch', 'breakfast', 'brunch', 'restaurant', 'bistro', 'trattoria', 'eatery', 'food', 'cuisine', 'meal', 'dine', 'supper'],
    cafe: ['coffee', 'cafe', 'café', 'tea', 'bakery', 'patisserie', 'espresso', 'latte'],
    hotel: ['hotel', 'resort', 'check-in', 'check in', 'check-out', 'accommodation', 'lodge', 'inn', 'hostel', 'villa', 'stay', 'suite'],
    museum: ['museum', 'gallery', 'exhibition', 'art', 'collection', 'exhibit'],
    cultural: ['temple', 'shrine', 'church', 'cathedral', 'mosque', 'monastery', 'palace', 'castle', 'historic', 'heritage', 'ancient', 'ruins'],
    nature: ['park', 'garden', 'hike', 'trail', 'mountain', 'lake', 'river', 'forest', 'waterfall', 'canyon', 'valley', 'scenic', 'viewpoint', 'sunrise', 'sunset'],
    beach: ['beach', 'ocean', 'sea', 'coast', 'swim', 'snorkel', 'dive', 'surf', 'sand', 'bay', 'cove', 'island'],
    shopping: ['market', 'shop', 'shopping', 'bazaar', 'souk', 'mall', 'boutique', 'store', 'vintage', 'antique'],
    nightlife: ['bar', 'pub', 'club', 'nightlife', 'cocktail', 'lounge', 'rooftop', 'jazz', 'live music'],
    spa: ['spa', 'massage', 'wellness', 'onsen', 'hammam', 'sauna', 'relax', 'thermal'],
    entertainment: ['show', 'concert', 'theater', 'theatre', 'performance', 'cinema', 'movie', 'festival'],
    activity: ['tour', 'adventure', 'experience', 'class', 'workshop', 'lesson', 'cooking', 'craft'],
    transport: ['flight', 'train', 'bus', 'ferry', 'taxi', 'transfer', 'airport', 'station', 'departure', 'arrival'],
  };
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'sightseeing'; // Default fallback
}

function generateCategoryFallbackDataUrl(category: string, venueName: string): string {
  const seed = `${category || 'default'}-${venueName || 'activity'}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 42) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${hue1},58%,42%)"/>
        <stop offset="100%" style="stop-color:hsl(${hue2},62%,30%)"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" font-family="system-ui" font-size="44" fill="white" fill-opacity="0.28" text-anchor="middle" dy=".35em">${venueName || category || 'Activity'}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function getCategoryFallbackImage(category: string, venueName: string): DestinationImage {
  const normalizedCategory = (category || 'default').toLowerCase();
  const fallbackUrl = generateCategoryFallbackDataUrl(normalizedCategory, venueName);
  
  return {
    id: `fallback-${normalizedCategory}-${Date.now()}`,
    url: fallbackUrl,
    alt: `${venueName} - ${category} photo`,
    type: "activity",
    source: "fallback",
    width: 1200,
    height: 800,
    attribution: "Generated placeholder",
  };
}

async function getDestinationName(supabase: any, destinationId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("destinations")
      .select("city, country")
      .eq("id", destinationId)
      .single();

    if (data?.city && data?.country) return `${data.city}, ${data.country}`;
    if (data?.city) return data.city;
    return null;
  } catch {
    return null;
  }
}

// Get a random iconic POI from destination for better hero images
async function getDestinationPOI(supabase: any, destinationName: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("destinations")
      .select("points_of_interest")
      .ilike("city", destinationName)
      .single();

    const pois = data?.points_of_interest;
    if (Array.isArray(pois) && pois.length > 0) {
      // Pick a random POI from the list
      const randomIndex = Math.floor(Math.random() * pois.length);
      console.log(`[Images] Found ${pois.length} POIs for ${destinationName}, using: ${pois[randomIndex]}`);
      return pois[randomIndex];
    }
    return null;
  } catch (e) {
    console.log(`[Images] Could not get POIs for ${destinationName}:`, e);
    return null;
  }
}

function generateFallbackGradient(destination: string): DestinationImage {
  let hash = 0;
  for (let i = 0; i < destination.length; i++) {
    hash = destination.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${hue1},60%,40%)"/>
        <stop offset="100%" style="stop-color:hsl(${hue2},70%,30%)"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" font-family="system-ui" font-size="52" fill="white" fill-opacity="0.28" text-anchor="middle" dy=".35em">${destination}</text>
  </svg>`;

  const base64 = btoa(svg);

  return {
    id: `fallback-${destination.replace(/\s/g, "-").toLowerCase()}`,
    url: `data:image/svg+xml;base64,${base64}`,
    alt: `${destination} - Placeholder`,
    type: "hero",
    source: "fallback",
    width: 1600,
    height: 900,
  };
}

// =============================================================================
// IMAGE QUALITY SCORING (Lovable AI Vision)
// =============================================================================

interface QualityScoreResult {
  score: number;
  pass: boolean;
  issues: string[];
  confidence: number;
}

/**
 * Score image quality using Lovable AI vision model.
 * Returns score 0-1, with images scoring below 0.6 considered low quality.
 */
async function scoreImageQuality(
  imageUrl: string,
  context: {
    destination?: string;
    venueName?: string;
    category?: string;
    expectedType?: 'destination' | 'activity' | 'hotel' | 'restaurant';
  },
  lovableApiKey: string
): Promise<QualityScoreResult> {
  const QUALITY_THRESHOLD = 0.6;
  
  try {
    // Build context for the prompt
    const contextParts: string[] = [];
    if (context.destination) contextParts.push(`destination: ${context.destination}`);
    if (context.venueName) contextParts.push(`venue: ${context.venueName}`);
    if (context.category) contextParts.push(`category: ${context.category}`);
    const contextStr = contextParts.length > 0 ? contextParts.join(", ") : "travel photo";

    console.log("[Quality] Scoring image:", imageUrl.slice(0, 60), "context:", contextStr);

    const prompt = `Analyze this travel image for quality. Context: ${contextStr}.
Score 0-100 based on: relevance to context (40%), image quality (30%), appropriateness (20%), aesthetics (10%).
REJECT (0-30) if: prominent faces, screenshots, watermarks, unrelated content, very low quality.
PASS (60-100) if: clearly shows destination/venue, high quality, travel-appropriate.
Respond ONLY with JSON: {"score": <0-100>, "issues": ["issue1"], "confidence": <0-100>}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", // Fast model for quick scoring
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 150,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log("[Quality] API error:", response.status);
      // Fail open - assume image is acceptable
      // Fail closed for API errors — don't cache bad images
      return { score: 0.5, pass: false, issues: ["api_error"], confidence: 0 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON response
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed: { score: number; issues: string[]; confidence: number };
    
    try {
      parsed = JSON.parse(cleanContent);
    } catch {
      // Try regex extraction
      const scoreMatch = content.match(/"score"\s*:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 70;
      parsed = { score, issues: [], confidence: 50 };
    }

    const normalizedScore = Math.max(0, Math.min(1, parsed.score / 100));
    
    console.log(`[Quality] Score: ${normalizedScore.toFixed(2)}, Pass: ${normalizedScore >= QUALITY_THRESHOLD}, Issues: ${parsed.issues?.join(", ") || "none"}`);

    return {
      score: normalizedScore,
      pass: normalizedScore >= QUALITY_THRESHOLD,
      issues: parsed.issues || [],
      confidence: Math.max(0, Math.min(1, (parsed.confidence || 70) / 100)),
    };
  } catch (e: any) {
    if (e.name === "AbortError") {
      console.log("[Quality] Timeout scoring image");
    } else {
      console.error("[Quality] Error:", e);
    }
    // Fail open
    // Fail closed — better to show a category fallback than a bad image
    return { score: 0.5, pass: false, issues: ["timeout"], confidence: 0 };
  }
}

// =============================================================================
// MAIN TIERED FETCH FUNCTION
// =============================================================================
async function fetchImageTiered(
  supabase: any,
  venueName: string,
  destination: string,
  entityType: string,
  category?: string,
  googleApiKey?: string,
  tripAdvisorApiKey?: string,
  lovableApiKey?: string,
  skipCache?: boolean
): Promise<DestinationImage> {
  // Step 1: Clean the venue name and check if we should skip API search
  const { cleanName, shouldSkip, inferredCategory } = extractVenueName(venueName);
  
  // Use inferred category if no explicit category provided
  const effectiveCategory = category || inferredCategory || 'activity';
  
  if (shouldSkip) {
    console.log(`[Images] Skipping API search for generic activity: "${venueName}", using category fallback (${effectiveCategory})`);
    return getCategoryFallbackImage(effectiveCategory, venueName);
  }
  
  console.log(`[Images] Searching for: "${cleanName}" (original: "${venueName}", category: ${effectiveCategory})`);
  
  const candidates: DestinationImage[] = [];

  // TIER 1: Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cached = await checkCuratedCache(supabase, entityType, cleanName, destination, effectiveCategory);
    if (cached) {
      return cached;
    }
  }

  // TIER 2: Google Places (best for real venue photos)
  if (googleApiKey) {
    const googleImage = await getGooglePlacesPhoto(
      (entityType === 'destination' ? 'destination' : 'activity'),
      cleanName,
      destination,
      googleApiKey,
      effectiveCategory
    );
    if (googleImage) {
      candidates.push(googleImage);
    }
  }

  // TIER 3: TripAdvisor (good for attractions/restaurants)
  if (tripAdvisorApiKey && candidates.length === 0) {
    const tripAdvisorImage = await getTripAdvisorPhoto(cleanName, destination, tripAdvisorApiKey);
    if (tripAdvisorImage) {
      candidates.push(tripAdvisorImage);
    }
  }

  // TIER 4: Wikimedia (free, good for landmarks)
  if (candidates.length === 0) {
    const wikimediaImage = await getWikimediaPhoto(cleanName, destination);
    if (wikimediaImage) {
      candidates.push(wikimediaImage);
    }
  }

  // If we have real photo candidates, validate quality and cache
  if (candidates.length > 0) {
    let bestImage = candidates[0];
    let qualityScore = 0.8; // Default assumed quality
    
    // If multiple candidates and AI available, rank them
    if (candidates.length > 1 && lovableApiKey) {
      const ranked = await rankImageCandidates(candidates, cleanName, lovableApiKey);
      if (ranked) {
        bestImage = ranked;
      }
    }

    // NEW: Quality scoring with Lovable AI Vision
    // Only score if we have the API key and the image is from an external source
    if (lovableApiKey && bestImage.source !== 'curated') {
      const qualityResult = await scoreImageQuality(
        bestImage.url,
        {
          destination,
          venueName: cleanName,
          category: effectiveCategory,
          expectedType: entityType === 'destination' ? 'destination' : 'activity',
        },
        lovableApiKey
      );

      qualityScore = qualityResult.pass ? qualityResult.score : Math.min(qualityResult.score, 0.5);

      // If image fails quality check, try next candidate or fallback
      if (!qualityResult.pass) {
        console.log(`[Images] Image failed quality check (${qualityResult.score.toFixed(2)}): ${bestImage.url.slice(0, 60)}`);
        console.log(`[Images] Issues: ${qualityResult.issues.join(", ")}`);
        
        // Try other candidates if available
        for (let i = 1; i < candidates.length; i++) {
          const altResult = await scoreImageQuality(
            candidates[i].url,
            {
              destination,
              venueName: cleanName,
              category: effectiveCategory,
            },
            lovableApiKey
          );
          
          if (altResult.pass) {
            bestImage = candidates[i];
            qualityScore = altResult.score;
            console.log(`[Images] Using alternative candidate with score ${qualityScore.toFixed(2)}`);
            break;
          }
        }
        
        // If all candidates fail, use category fallback
        if (qualityScore < 0.6) {
          console.log(`[Images] All candidates failed quality check, using category fallback`);
          return getCategoryFallbackImage(effectiveCategory, venueName);
        }
      }
    }

    // Persist external image URLs into our own storage when possible.
    const persistentBestImage = await ensurePersistentStorageUrl(
      bestImage,
      entityType,
      venueName,
      destination
    );

    // Cache the result with quality score
    await cacheImage(supabase, entityType, venueName, destination, persistentBestImage, qualityScore);
    
    return persistentBestImage;
  }

  // TIER 5: AI Generation (try before category fallback for better quality)
  if (lovableApiKey) {
    const aiImage = await generateAIImage(cleanName, destination, lovableApiKey);
    if (aiImage) {
      const persistentAiImage = await ensurePersistentStorageUrl(
        aiImage,
        entityType,
        venueName,
        destination
      );

      // Cache AI images with lower quality score
      await cacheImage(supabase, entityType, venueName, destination, persistentAiImage, 0.5);
      return persistentAiImage;
    }
  }

  // TIER 6: Category-specific fallback (high-quality curated images)
  console.log(`[Images] No API results, using category fallback for: "${venueName}" (category: ${effectiveCategory})`);
  return getCategoryFallbackImage(effectiveCategory, venueName);
}

// =============================================================================
// AUTHENTICATION HELPER
// =============================================================================
async function validateAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }
    return { userId: data.user.id };
  } catch {
    return null;
  }
}

// =============================================================================
// SERVE
// =============================================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const costTracker = trackCost('destination_images', 'google_places');

  try {
    // Allow both authenticated and anonymous requests for destination images
    // This is safe because we're only serving publicly-available images
    const authResult = await validateAuth(req);
    const userId = authResult?.userId || 'anonymous';
    if (authResult?.userId) costTracker.setUserId(authResult.userId);
    console.log(`[Images] Request from: ${userId}`);

    // Parse params from both query string and body
    const url = new URL(req.url);
    let params: RequestParams = {};

    // Get query params first
    const qDestinationId = url.searchParams.get("destinationId");
    const qDestination = url.searchParams.get("destination");
    const qImageType = url.searchParams.get("imageType");
    const qLimit = url.searchParams.get("limit");
    const qVenueName = url.searchParams.get("venueName");
    const qCategory = url.searchParams.get("category");
    const qSkipCache = url.searchParams.get("skipCache");

    if (qDestinationId) params.destinationId = qDestinationId;
    if (qDestination) params.destination = qDestination;
    if (qImageType) params.imageType = qImageType;
    if (qLimit) params.limit = parseInt(qLimit);
    if (qVenueName) params.venueName = qVenueName;
    if (qCategory) params.category = qCategory;
    if (qSkipCache) params.skipCache = qSkipCache === 'true';

    // Then try to parse body (POST)
    if (req.method === "POST") {
      try {
        const body = await req.json();
        console.log("[Images] Received body:", JSON.stringify(body));
        if (body.destinationId) params.destinationId = body.destinationId;
        if (body.destination) params.destination = body.destination;
        if (body.imageType) params.imageType = body.imageType;
        if (body.limit) params.limit = body.limit;
        if (body.venueName) params.venueName = body.venueName;
        if (body.category) params.category = body.category;
        if (body.skipCache !== undefined) params.skipCache = body.skipCache;
      } catch (e) {
        console.log("[Images] Could not parse body:", e);
      }
    }

    console.log("[Images] Parsed params:", JSON.stringify(params));

    const destinationId = params.destinationId;
    const destination = params.destination;
    const imageType = params.imageType || "hero";
    const venueName = params.venueName;

    if (!destinationId && !destination && !venueName) {
      return new Response(JSON.stringify({ error: "destinationId, destination name, or venueName is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const tripAdvisorApiKey = Deno.env.get("TRIPADVISOR_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    let resolvedDestination = destination;
    if (!resolvedDestination && destinationId) {
      resolvedDestination = await getDestinationName(supabase, destinationId) || undefined;
    }

    // Normalize destination to strip airport-related keywords
    function normalizeDestination(dest: string): string {
      return (dest || '')
        // Remove trailing IATA codes like "(FCO)"
        .replace(/\s*\([A-Z]{3}\)\s*/gi, '')
        // Remove obvious airport keywords
        .replace(/\b(international\s+)?airport\b/gi, '')
        // Remove terminal references
        .replace(/\b(terminal\s*\d?|arrivals?|departures?)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }

    // Determine what we're searching for
    const searchSubjectRaw = normalizeDestination(venueName || resolvedDestination || "unknown");
    const entityType = venueName ? "activity" : "destination";
    const contextDestination = normalizeDestination(resolvedDestination || destination || "");

    // For destination hero/gallery lookups, use a known POI for better images
    let searchSubject = searchSubjectRaw;
    if (entityType === "destination") {
      // Try to get an iconic POI from the destination (e.g., "Eiffel Tower" for Paris)
      const poiName = await getDestinationPOI(supabase, contextDestination);
      if (poiName) {
        searchSubject = poiName;
        console.log(`[Images] Using POI "${poiName}" instead of generic "${searchSubjectRaw}"`);
      } else {
        // Fall back to "city landmark" search
        searchSubject = `${searchSubjectRaw} landmark`;
        console.log(`[Images] No POIs found, searching for "${searchSubject}"`);
      }
    }

    console.log(`[Images] Fetching ${entityType} image for: ${searchSubject} in ${contextDestination}`);

    const image = await fetchImageTiered(
      supabase,
      searchSubject,
      contextDestination,
      entityType,
      params.category, // Pass category for fallback images
      googleApiKey,
      tripAdvisorApiKey,
      lovableApiKey,
      params.skipCache
    );

    // Update type if specified
    const finalImage = { ...image, type: imageType as any };

    // Track Google Places and Photos calls.
    // IMPORTANT: only count a Google Photo call on cache MISS (we had to download from Google).
    if (finalImage.source === 'google_places') {
      costTracker.recordGooglePlaces(1);
      if (finalImage.cacheHit === false) {
        costTracker.recordGooglePhotos(1);
      }
    }
    await costTracker.save();

    return new Response(
      JSON.stringify({
        success: true,
        images: [finalImage],
        source: finalImage.source,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[Images] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
