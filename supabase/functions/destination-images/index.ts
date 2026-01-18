import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlacesPhotoResponse {
  result?: {
    photos?: Array<{
      photo_reference: string;
      width: number;
      height: number;
    }>;
    name?: string;
  };
  status: string;
}

interface DestinationImage {
  id: string;
  url: string;
  alt: string;
  type: 'hero' | 'gallery' | 'activity';
  source: 'database' | 'google_places' | 'fallback';
  width?: number;
  height?: number;
}

async function getGooglePlacesPhoto(
  destination: string,
  apiKey: string
): Promise<DestinationImage | null> {
  try {
    // First, search for the place to get a place_id
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(destination)}&inputtype=textquery&fields=place_id,name,photos&key=${apiKey}`;
    
    console.log('[Images] Searching Google Places for:', destination);
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      console.error('[Images] Google Places search error:', searchResponse.status);
      return null;
    }
    
    const searchData = await searchResponse.json();
    
    if (searchData.status !== 'OK' || !searchData.candidates?.[0]) {
      console.log('[Images] No Google Places results for:', destination);
      return null;
    }
    
    const candidate = searchData.candidates[0];
    const photoRef = candidate.photos?.[0]?.photo_reference;
    
    if (!photoRef) {
      console.log('[Images] No photos available for:', destination);
      return null;
    }
    
    // Construct the photo URL (returns actual image)
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoRef}&key=${apiKey}`;
    
    return {
      id: `google-${candidate.place_id}`,
      url: photoUrl,
      alt: `${candidate.name || destination} - Photo`,
      type: 'hero',
      source: 'google_places',
      width: 1200,
      height: 800,
    };
  } catch (error) {
    console.error('[Images] Google Places error:', error);
    return null;
  }
}

async function getDatabaseImages(
  supabase: any,
  destinationId: string,
  imageType?: string,
  limit: number = 10
): Promise<DestinationImage[]> {
  try {
    let query = supabase
      .from('destination_images')
      .select('*')
      .eq('destination_id', destinationId)
      .order('is_hero', { ascending: false })
      .order('is_primary', { ascending: false })
      .limit(limit);
    
    if (imageType === 'hero') {
      query = query.eq('is_hero', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[Images] Database error:', error);
      return [];
    }
    
    return (data || []).map((img: any) => ({
      id: img.id,
      url: img.image_url,
      alt: img.alt_text || 'Destination image',
      type: img.is_hero ? 'hero' : 'gallery',
      source: 'database' as const,
    }));
  } catch (error) {
    console.error('[Images] Database query error:', error);
    return [];
  }
}

async function getDestinationName(
  supabase: any,
  destinationId: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('destinations')
      .select('city, country')
      .eq('id', destinationId)
      .single();
    
    if (data) {
      return `${data.city}, ${data.country}`;
    }
    return null;
  } catch {
    return null;
  }
}

function generateFallbackGradient(destination: string): DestinationImage {
  // Generate a consistent color based on destination name
  let hash = 0;
  for (let i = 0; i < destination.length; i++) {
    hash = destination.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40) % 360;
  
  // Return a data URL for an SVG gradient
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${hue1},60%,40%)"/>
        <stop offset="100%" style="stop-color:hsl(${hue2},70%,30%)"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" font-family="system-ui" font-size="48" fill="white" fill-opacity="0.3" text-anchor="middle" dy=".35em">${destination}</text>
  </svg>`;
  
  const base64 = btoa(svg);
  
  return {
    id: `fallback-${destination.replace(/\s/g, '-').toLowerCase()}`,
    url: `data:image/svg+xml;base64,${base64}`,
    alt: `${destination} - Placeholder`,
    type: 'hero',
    source: 'fallback',
    width: 1200,
    height: 800,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const destinationId = url.searchParams.get('destinationId');
    const destination = url.searchParams.get('destination');
    const imageType = url.searchParams.get('imageType') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (!destinationId && !destination) {
      return new Response(
        JSON.stringify({ error: 'destinationId or destination name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    
    let images: DestinationImage[] = [];
    let resolvedDestination = destination;
    
    // Try database first if we have destinationId
    if (destinationId) {
      images = await getDatabaseImages(supabase, destinationId, imageType, limit);
      
      // Get destination name for fallback if needed
      if (images.length === 0 && !resolvedDestination) {
        resolvedDestination = await getDestinationName(supabase, destinationId);
      }
    }
    
    // If no database images, try Google Places
    if (images.length === 0 && resolvedDestination && googleApiKey) {
      const googleImage = await getGooglePlacesPhoto(resolvedDestination, googleApiKey);
      if (googleImage) {
        images = [googleImage];
        console.log('[Images] Using Google Places image for:', resolvedDestination);
      }
    }
    
    // Final fallback: gradient placeholder
    if (images.length === 0 && resolvedDestination) {
      images = [generateFallbackGradient(resolvedDestination)];
      console.log('[Images] Using gradient fallback for:', resolvedDestination);
    }

    return new Response(
      JSON.stringify({
        success: true,
        images,
        source: images[0]?.source || 'none',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Images] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
