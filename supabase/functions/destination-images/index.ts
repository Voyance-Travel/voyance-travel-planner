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
  source: "pexels" | "google_places" | "lovable_ai" | "fallback";
  width?: number;
  height?: number;
}

interface RequestParams {
  destinationId?: string;
  destination?: string;
  imageType?: string;
  limit?: number;
}

async function getPexelsPhoto(destination: string, apiKey: string): Promise<DestinationImage | null> {
  try {
    console.log("[Images] Searching Pexels for:", destination);

    const query = `${destination} landmark`;
    const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&size=large`;

    const res = await fetch(pexelsUrl, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!res.ok) {
      console.error("[Images] Pexels search error:", res.status);
      return null;
    }

    const json = await res.json();
    const photo = json?.photos?.[0];
    const url = photo?.src?.large2x || photo?.src?.large || photo?.src?.original;
    if (!url) {
      console.log("[Images] No Pexels photos for:", destination);
      return null;
    }

    return {
      id: `pexels-${photo.id}`,
      url,
      alt: `${destination} - Photo`,
      type: "hero",
      source: "pexels",
      width: photo.width,
      height: photo.height,
    };
  } catch (error) {
    console.error("[Images] Pexels error:", error);
    return null;
  }
}

async function getGooglePlacesPhoto(destination: string, apiKey: string): Promise<DestinationImage | null> {
  try {
    // Use Text Search API which is more reliable for destinations
    const query = `${destination} city landmark`;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${apiKey}`;

    console.log("[Images] Searching Google Places (textsearch) for:", destination);

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      console.error("[Images] Google Places search error:", searchResponse.status);
      return null;
    }

    const searchData = await searchResponse.json();
    console.log("[Images] Google Places status:", searchData.status, "results:", searchData.results?.length || 0);

    if (searchData.status !== "OK" || !searchData.results?.length) {
      console.log("[Images] No Google Places results for:", destination);
      return null;
    }

    // Find the first result with photos
    const resultWithPhoto = searchData.results.find((r: any) => r.photos?.length > 0);
    if (!resultWithPhoto) {
      console.log("[Images] No photos in any Google Places results for:", destination);
      return null;
    }

    const photoRef = resultWithPhoto.photos[0].photo_reference;
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${photoRef}&key=${apiKey}`;

    console.log("[Images] ✅ Found Google Places photo for:", destination);

    return {
      id: `google-${resultWithPhoto.place_id}`,
      url: photoUrl,
      alt: `${resultWithPhoto.name || destination} - Photo`,
      type: "hero",
      source: "google_places",
      width: 1600,
      height: 900,
    };
  } catch (error) {
    console.error("[Images] Google Places error:", error);
    return null;
  }
}

async function generateAIImage(destination: string, lovableApiKey: string): Promise<DestinationImage | null> {
  try {
    console.log("[Images] Generating AI image for:", destination);
    
    const prompt = `A beautiful, high-quality travel photograph of ${destination}. Scenic landmark view, golden hour lighting, professional travel photography, no people, ultra high resolution. 16:9 aspect ratio.`;
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          { role: "user", content: prompt }
        ],
        modalities: ["image", "text"]
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

    console.log("[Images] Successfully generated AI image for:", destination);

    return {
      id: `ai-${destination.replace(/\s/g, "-").toLowerCase()}-${Date.now()}`,
      url: imageUrl,
      alt: `${destination} - AI Generated Travel Photo`,
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

async function getDestinationName(supabase: any, destinationId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("destinations")
      .select("city, country")
      .eq("id", destinationId)
      .single();

    if (data?.city && data?.country) return `${data.city}, ${data.country}`;
    if (data?.city) return `${data.city}`;
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

    if (qDestinationId) params.destinationId = qDestinationId;
    if (qDestination) params.destination = qDestination;
    if (qImageType) params.imageType = qImageType;
    if (qLimit) params.limit = parseInt(qLimit);

    // Then try to parse body (POST)
    if (req.method === "POST") {
      try {
        const body = await req.json();
        console.log("[Images] Received body:", JSON.stringify(body));
        if (body.destinationId) params.destinationId = body.destinationId;
        if (body.destination) params.destination = body.destination;
        if (body.imageType) params.imageType = body.imageType;
        if (body.limit) params.limit = body.limit;
      } catch (e) {
        console.log("[Images] Could not parse body:", e);
      }
    }

    console.log("[Images] Parsed params:", JSON.stringify(params));

    const destinationId = params.destinationId;
    const destination = params.destination;
    const imageType = params.imageType || "hero";
    const limit = Math.max(1, Math.min(params.limit || 1, 10));

    if (!destinationId && !destination) {
      return new Response(JSON.stringify({ error: "destinationId or destination name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const pexelsApiKey = Deno.env.get("PEXELS_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    let resolvedDestination = destination;
    if (!resolvedDestination && destinationId) {
      resolvedDestination = await getDestinationName(supabase, destinationId) || undefined;
    }

    if (!resolvedDestination) {
      return new Response(JSON.stringify({ error: "Could not resolve destination name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let images: DestinationImage[] = [];

    // Priority 1: Google Places (most reliable for real destination photos)
    if (googleApiKey) {
      const googleImage = await getGooglePlacesPhoto(resolvedDestination, googleApiKey);
      if (googleImage) {
        images = [googleImage];
        console.log("[Images] ✅ Using Google Places image for:", resolvedDestination);
      }
    }

    // Priority 2: Lovable AI Generated (fallback if Google fails)
    if (images.length === 0 && lovableApiKey) {
      console.log("[Images] Trying Lovable AI image for:", resolvedDestination);
      const aiImage = await generateAIImage(resolvedDestination, lovableApiKey);
      if (aiImage) {
        images = [aiImage];
        console.log("[Images] ✅ Using AI-generated image for:", resolvedDestination);
      }
    }

    // Priority 3: Gradient fallback (last resort)
    if (images.length === 0) {
      images = [generateFallbackGradient(resolvedDestination)];
      console.log("[Images] Using gradient fallback for:", resolvedDestination);
    }

    // Update type if specified
    if (images[0]) {
      images[0] = { ...images[0], type: imageType as any };
    }

    return new Response(
      JSON.stringify({
        success: true,
        images,
        source: images[0]?.source || "none",
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
