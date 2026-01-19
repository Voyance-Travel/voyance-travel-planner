import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  destination?: string
): Promise<DestinationImage | null> {
  try {
    const normalizedKey = entityKey.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').slice(0, 100);
    
    let query = supabase
      .from("curated_images")
      .select("*")
      .eq("entity_type", entityType)
      .ilike("entity_key", `%${normalizedKey}%`);
    
    if (destination) {
      query = query.ilike("destination", `%${destination}%`);
    }
    
    const { data, error } = await query.limit(1).maybeSingle();
    
    if (error || !data) {
      return null;
    }
    
    console.log(`[Images] ✅ Found cached image for: ${entityKey}`);
    
    return {
      id: data.id,
      url: data.image_url,
      alt: data.alt_text || `${entityKey} photo`,
      type: entityType === "destination" ? "hero" : "activity",
      source: "curated",
      attribution: data.attribution,
      placeId: data.place_id,
      photoReference: data.photo_reference,
    };
  } catch (e) {
    console.error("[Images] Cache check error:", e);
    return null;
  }
}

// =============================================================================
// TIER 2: GOOGLE PLACES PHOTOS (New Places API v1)
// =============================================================================
async function getGooglePlacesPhoto(
  venueName: string,
  destination: string,
  apiKey: string
): Promise<DestinationImage | null> {
  try {
    const textQuery = `${venueName} ${destination}`;
    console.log("[Images] Searching Google Places (v1) for:", textQuery);

    // Use AbortController for 3-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      // Step 1: Search for place using new Places API v1
      const searchResponse = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
          },
          body: JSON.stringify({
            textQuery,
            maxResultCount: 3,
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
      
      console.log("[Images] Google Places v1 results:", places.length);

      if (places.length === 0) {
        console.log("[Images] No Google Places v1 results for:", textQuery);
        return null;
      }

      // Find first place with photos
      const placeWithPhotos = places.find((p: any) => p.photos?.length > 0);
      if (!placeWithPhotos) {
        console.log("[Images] No photos in Google Places v1 results for:", textQuery);
        return null;
      }

      // Step 2: Get photo URL using the photo resource name
      // Format: places/{place_id}/photos/{photo_reference}
      const photoResource = placeWithPhotos.photos[0].name;
      
      // New API uses different photo URL format
      const photoUrl = `https://places.googleapis.com/v1/${photoResource}/media?maxWidthPx=1200&key=${apiKey}`;

      console.log("[Images] ✅ Found Google Places v1 photo for:", venueName);

      return {
        id: `google-${placeWithPhotos.id}`,
        url: photoUrl,
        alt: `${placeWithPhotos.displayName?.text || venueName} - Photo`,
        type: "activity",
        source: "google_places",
        width: 1200,
        height: 800,
        placeId: placeWithPhotos.id,
        photoReference: photoResource,
      };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.log("[Images] Google Places v1 timeout (3s) for:", textQuery);
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

    console.log("[Images] ✅ Found TripAdvisor photo for:", venueName);

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
// CACHE RESULT
// =============================================================================
async function cacheImage(
  supabase: any,
  entityType: string,
  entityKey: string,
  destination: string,
  image: DestinationImage,
  qualityScore?: number
): Promise<void> {
  try {
    const normalizedKey = entityKey.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').slice(0, 100);

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
function extractVenueName(activityTitle: string): { cleanName: string; shouldSkip: boolean } {
  const title = activityTitle.trim();
  
  // Activities that should use category fallback instead of search
  const skipPatterns = [
    /^(afternoon|morning|evening)\s+(siesta|rest|recharge|relaxation|break)/i,
    /^(free\s+time|leisure|downtime|rest\s+day)/i,
    /^(hotel\s+check[\-\s]?(in|out)|check[\-\s]?(in|out)\s+at)/i,
    /^(arrival|departure|transfer|airport)/i,
    /^(pack|unpack|settle\s+in)/i,
    /^(breakfast|lunch|dinner)\s+(break|time)$/i, // Just "Lunch break" not "Lunch at Café X"
  ];
  
  for (const pattern of skipPatterns) {
    if (pattern.test(title)) {
      return { cleanName: title, shouldSkip: true };
    }
  }
  
  // Extract venue from patterns like "Dinner at X", "Visit X", "Tour of X", etc.
  const extractPatterns = [
    /^(?:dinner|lunch|breakfast|brunch|meal)\s+(?:at|@)\s+(.+)/i,
    /^(?:check[\-\s]?in|stay)\s+(?:at|@)\s+(.+)/i,
    /^(?:visit|explore|tour|see|experience)\s+(?:the\s+)?(.+)/i,
    /^(?:shopping|browse)\s+(?:at|@)\s+(.+)/i,
    /^(.+?)\s+(?:exploration|experience|tour|visit)$/i,
    /^(.+?)\s+(?:for\s+(?:dinner|lunch|breakfast))$/i,
  ];
  
  for (const pattern of extractPatterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Only use if it looks like a venue name (not generic)
      if (extracted.length > 3 && !/^(the|a|an|some|good)$/i.test(extracted)) {
        return { cleanName: extracted, shouldSkip: false };
      }
    }
  }
  
  return { cleanName: title, shouldSkip: false };
}

// High-quality category fallback images (curated Unsplash photos)
const CATEGORY_FALLBACKS: Record<string, string> = {
  dining: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80", // Elegant restaurant
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80", // Food plate
  sightseeing: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80", // Scenic view
  cultural: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=80", // Museum interior
  museum: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=80",
  shopping: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80", // Shopping street
  relaxation: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&q=80", // Spa/wellness
  spa: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&q=80",
  accommodation: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80", // Hotel room
  hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80",
  transport: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&q=80", // Travel transport
  activity: "https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1200&q=80", // Adventure activity
  beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80", // Beach sunset
  nature: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80", // Nature landscape
  nightlife: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80", // Night scene
  entertainment: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80", // Concert/show
  default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80", // Travel general
};

function getCategoryFallbackImage(category: string, venueName: string): DestinationImage {
  const normalizedCategory = (category || 'default').toLowerCase();
  const fallbackUrl = CATEGORY_FALLBACKS[normalizedCategory] || CATEGORY_FALLBACKS.default;
  
  return {
    id: `fallback-${normalizedCategory}-${Date.now()}`,
    url: fallbackUrl,
    alt: `${venueName} - ${category} photo`,
    type: "activity",
    source: "fallback",
    width: 1200,
    height: 800,
    attribution: "Unsplash",
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
  const { cleanName, shouldSkip } = extractVenueName(venueName);
  
  if (shouldSkip) {
    console.log(`[Images] Skipping API search for generic activity: "${venueName}", using category fallback`);
    return getCategoryFallbackImage(category || 'activity', venueName);
  }
  
  console.log(`[Images] Searching for: "${cleanName}" (original: "${venueName}")`);
  
  const candidates: DestinationImage[] = [];

  // TIER 1: Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cached = await checkCuratedCache(supabase, entityType, cleanName, destination);
    if (cached) {
      return cached;
    }
  }

  // TIER 2: Google Places (best for real venue photos)
  if (googleApiKey) {
    const googleImage = await getGooglePlacesPhoto(cleanName, destination, googleApiKey);
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

  // If we have real photo candidates, optionally rank with AI and cache
  if (candidates.length > 0) {
    let bestImage = candidates[0];
    
    // If multiple candidates and AI available, rank them
    if (candidates.length > 1 && lovableApiKey) {
      const ranked = await rankImageCandidates(candidates, cleanName, lovableApiKey);
      if (ranked) {
        bestImage = ranked;
      }
    }

    // Cache the result (use original venueName for cache key)
    await cacheImage(supabase, entityType, venueName, destination, bestImage, 0.9);
    
    return bestImage;
  }

  // TIER 5: Category-specific fallback (high-quality curated images)
  // Skip AI generation for most cases - curated fallbacks are faster and more reliable
  if (category) {
    console.log(`[Images] No API results, using category fallback for: "${venueName}" (category: ${category})`);
    return getCategoryFallbackImage(category, venueName);
  }

  // TIER 6: AI Generation (only if no category fallback available)
  if (lovableApiKey) {
    const aiImage = await generateAIImage(cleanName, destination, lovableApiKey);
    if (aiImage) {
      // Cache AI images with lower quality score
      await cacheImage(supabase, entityType, venueName, destination, aiImage, 0.5);
      return aiImage;
    }
  }

  // TIER 7: Gradient fallback (absolute last resort)
  console.log("[Images] Using gradient fallback for:", venueName);
  return generateFallbackGradient(venueName);
}

// =============================================================================
// SERVE
// =============================================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Determine what we're searching for
    const searchSubject = venueName || resolvedDestination || "unknown";
    const entityType = venueName ? "activity" : "destination";
    const contextDestination = resolvedDestination || destination || "";

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
