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
// TIER 2: GOOGLE PLACES PHOTOS (Real venue photos)
// =============================================================================
async function getGooglePlacesPhoto(
  venueName: string,
  destination: string,
  apiKey: string
): Promise<DestinationImage | null> {
  try {
    // Precise search: venue name + destination for exact match
    const query = `${venueName} ${destination}`;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;

    console.log("[Images] Searching Google Places for:", query);

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      console.error("[Images] Google Places search error:", searchResponse.status);
      return null;
    }

    const searchData = await searchResponse.json();
    console.log("[Images] Google Places status:", searchData.status, "results:", searchData.results?.length || 0);

    if (searchData.status !== "OK" || !searchData.results?.length) {
      console.log("[Images] No Google Places results for:", query);
      return null;
    }

    // Find the best result with photos (prioritize exact name match)
    let bestResult = searchData.results.find((r: any) => 
      r.photos?.length > 0 && r.name?.toLowerCase().includes(venueName.toLowerCase().split(' ')[0])
    );
    
    if (!bestResult) {
      bestResult = searchData.results.find((r: any) => r.photos?.length > 0);
    }
    
    if (!bestResult) {
      console.log("[Images] No photos in Google Places results for:", query);
      return null;
    }

    const photoRef = bestResult.photos[0].photo_reference;
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoRef}&key=${apiKey}`;

    console.log("[Images] ✅ Found Google Places photo for:", venueName);

    return {
      id: `google-${bestResult.place_id}`,
      url: photoUrl,
      alt: `${bestResult.name || venueName} - Photo`,
      type: "activity",
      source: "google_places",
      width: 1200,
      height: 800,
      placeId: bestResult.place_id,
      photoReference: photoRef,
    };
  } catch (error) {
    console.error("[Images] Google Places error:", error);
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
  googleApiKey?: string,
  tripAdvisorApiKey?: string,
  lovableApiKey?: string,
  skipCache?: boolean
): Promise<DestinationImage> {
  const candidates: DestinationImage[] = [];

  // TIER 1: Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cached = await checkCuratedCache(supabase, entityType, venueName, destination);
    if (cached) {
      return cached;
    }
  }

  // TIER 2: Google Places (best for real venue photos)
  if (googleApiKey) {
    const googleImage = await getGooglePlacesPhoto(venueName, destination, googleApiKey);
    if (googleImage) {
      candidates.push(googleImage);
    }
  }

  // TIER 3: TripAdvisor (good for attractions/restaurants)
  if (tripAdvisorApiKey && candidates.length === 0) {
    const tripAdvisorImage = await getTripAdvisorPhoto(venueName, destination, tripAdvisorApiKey);
    if (tripAdvisorImage) {
      candidates.push(tripAdvisorImage);
    }
  }

  // TIER 4: Wikimedia (free, good for landmarks)
  if (candidates.length === 0) {
    const wikimediaImage = await getWikimediaPhoto(venueName, destination);
    if (wikimediaImage) {
      candidates.push(wikimediaImage);
    }
  }

  // If we have real photo candidates, optionally rank with AI and cache
  if (candidates.length > 0) {
    let bestImage = candidates[0];
    
    // If multiple candidates and AI available, rank them
    if (candidates.length > 1 && lovableApiKey) {
      const ranked = await rankImageCandidates(candidates, venueName, lovableApiKey);
      if (ranked) {
        bestImage = ranked;
      }
    }

    // Cache the result
    await cacheImage(supabase, entityType, venueName, destination, bestImage, 0.9);
    
    return bestImage;
  }

  // TIER 5: AI Generation (last resort)
  if (lovableApiKey) {
    const aiImage = await generateAIImage(venueName, destination, lovableApiKey);
    if (aiImage) {
      // Cache AI images with lower quality score
      await cacheImage(supabase, entityType, venueName, destination, aiImage, 0.5);
      return aiImage;
    }
  }

  // TIER 6: Gradient fallback (absolute last resort)
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
