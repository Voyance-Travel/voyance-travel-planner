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
  source: "google_places" | "fallback"; // Intentionally NOT using database images
  width?: number;
  height?: number;
}

interface RequestParams {
  destinationId?: string | null;
  destination?: string | null;
  imageType?: string | null;
  limit?: number | null;
}

async function getGooglePlacesPhoto(destination: string, apiKey: string): Promise<DestinationImage | null> {
  try {
    // Find a place candidate (includes photos)
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
      destination
    )}&inputtype=textquery&fields=place_id,name,photos&key=${apiKey}`;

    console.log("[Images] Searching Google Places for:", destination);

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      console.error("[Images] Google Places search error:", searchResponse.status);
      return null;
    }

    const searchData = await searchResponse.json();

    if (searchData.status !== "OK" || !searchData.candidates?.[0]) {
      console.log("[Images] No Google Places results for:", destination);
      return null;
    }

    const candidate = searchData.candidates[0];
    const photoRef = candidate.photos?.[0]?.photo_reference;

    if (!photoRef) {
      console.log("[Images] No photos available for:", destination);
      return null;
    }

    // Returns actual image bytes (HTTP 302 to CDN)
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${photoRef}&key=${apiKey}`;

    return {
      id: `google-${candidate.place_id}`,
      url: photoUrl,
      alt: `${candidate.name || destination} - Photo`,
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
  // Generate consistent colors based on destination name
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

function getParamsFromUrl(url: URL): RequestParams {
  const destinationId = url.searchParams.get("destinationId");
  const destination = url.searchParams.get("destination");
  const imageType = url.searchParams.get("imageType");
  const limitRaw = url.searchParams.get("limit");

  return {
    destinationId,
    destination,
    imageType,
    limit: limitRaw ? Number(limitRaw) : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Support both GET (query params) and POST (JSON body)
    let params: RequestParams = getParamsFromUrl(url);
    if (req.method === "POST") {
      try {
        const body = (await req.json()) as RequestParams;
        params = { ...params, ...body };
      } catch {
        // ignore malformed JSON and fall back to URL params
      }
    }

    const destinationId = params.destinationId ?? undefined;
    const destination = params.destination ?? undefined;
    const imageType = (params.imageType ?? undefined) || undefined;
    const limit = Math.max(1, Math.min(Number(params.limit ?? 10) || 10, 20));

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

    let resolvedDestination = destination;
    if (!resolvedDestination && destinationId) {
      resolvedDestination = (await getDestinationName(supabase, destinationId)) ?? undefined;
    }

    let images: DestinationImage[] = [];

    // Primary: Google Places
    if (resolvedDestination && googleApiKey) {
      const googleImage = await getGooglePlacesPhoto(resolvedDestination, googleApiKey);
      if (googleImage) {
        images = [googleImage];
        console.log("[Images] Using Google Places image for:", resolvedDestination);
      }
    }

    // Final fallback: gradient placeholder
    if (images.length === 0 && resolvedDestination) {
      images = [generateFallbackGradient(resolvedDestination)];
      console.log("[Images] Using gradient fallback for:", resolvedDestination);
    }

    // If caller asked for more than 1 image (gallery/activity), repeat hero for now
    if (images.length === 1 && limit > 1) {
      images = Array.from({ length: limit }, (_, i) => ({
        ...images[0],
        id: `${images[0].id}-${i}`,
        type: (imageType as any) || images[0].type,
      }));
    } else if (imageType && images[0]) {
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
