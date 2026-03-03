import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EnrichmentRequest {
  tripId: string;
  destination: string;
  days: Array<{
    dayNumber: number;
    date: string;
    activities: Array<{
      id: string;
      name: string;
      location: string;
      coordinates?: { lat: number; lng: number };
    }>;
  }>;
}

interface WeatherData {
  temperature: { high: number; low: number };
  conditions: string;
  rainChance: number;
}

// Simulated weather data (in production, integrate with weather API)
function getWeatherForDate(destination: string, date: string): WeatherData {
  // Generate reasonable weather based on destination
  const baseTemp = destination.toLowerCase().includes('iceland') ? 5 :
                   destination.toLowerCase().includes('dubai') ? 35 :
                   destination.toLowerCase().includes('tokyo') ? 20 :
                   destination.toLowerCase().includes('paris') ? 18 :
                   destination.toLowerCase().includes('new york') ? 15 :
                   destination.toLowerCase().includes('london') ? 14 :
                   destination.toLowerCase().includes('rome') ? 22 :
                   destination.toLowerCase().includes('sydney') ? 24 :
                   destination.toLowerCase().includes('bangkok') ? 32 :
                   20;

  const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Clear'][Math.floor(Math.random() * 4)];
  const rainChance = Math.floor(Math.random() * 30);

  return {
    temperature: { high: baseTemp + 5, low: baseTemp - 3 },
    conditions,
    rainChance,
  };
}

// Calculate walking distance between two activities (simulated)
function calculateWalkingDistance(
  from: { lat?: number; lng?: number } | undefined,
  to: { lat?: number; lng?: number } | undefined
): { distance: number; time: number } | null {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) {
    return null;
  }

  // Haversine formula for distance
  const R = 6371e3; // Earth radius in meters
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δφ = ((to.lat - from.lat) * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = Math.round(R * c); // meters
  const walkingSpeed = 80; // meters per minute (about 5 km/h)
  const time = Math.round(distance / walkingSpeed);

  return { distance, time };
}

// Get destination photos
function getDestinationPhotos(destination: string): string[] {
  const fallbackPhotoIds = [
    'photo-1488646953014-85cb44e25828',
    'photo-1476514525535-07fb3b4ae5f1',
    'photo-1507525428034-b723cf961d3e',
    'photo-1469474968028-56623f02e42e',
    'photo-1530789253388-582c481c54b0',
  ];

  let hash = 0;
  for (let i = 0; i < destination.length; i++) {
    hash = (hash * 31 + destination.charCodeAt(i)) | 0;
  }

  const startIndex = Math.abs(hash) % fallbackPhotoIds.length;

  return Array.from({ length: 3 }).map((_, i) => {
    const photoId = fallbackPhotoIds[(startIndex + i) % fallbackPhotoIds.length];
    return `https://images.unsplash.com/${photoId}?w=800&h=600&fit=crop&auto=format&q=80`;
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: EnrichmentRequest = await req.json();
    const { tripId, destination, days } = body;

    console.log(`[enrich-itinerary] Enriching ${days.length} days for trip ${tripId}`);

    const enrichedDays = days.map((day) => {
      // Add weather data
      const weather = getWeatherForDate(destination, day.date);

      // Calculate walking distances between activities
      const activitiesWithDistances = day.activities.map((activity, index) => {
        if (index === 0) {
          return { ...activity, walkingDistance: null, walkingTime: null };
        }

        const prevActivity = day.activities[index - 1];
        const walkingData = calculateWalkingDistance(
          prevActivity.coordinates,
          activity.coordinates
        );

        return {
          ...activity,
          walkingDistance: walkingData?.distance || null,
          walkingTime: walkingData?.time || null,
        };
      });

      // Calculate totals
      const totalWalkingDistance = activitiesWithDistances.reduce(
        (sum, a) => sum + (a.walkingDistance || 0),
        0
      );

      // Determine pace score
      const paceScore = day.activities.length <= 3 ? 'relaxed' :
                        day.activities.length <= 5 ? 'moderate' : 'packed';

      return {
        ...day,
        activities: activitiesWithDistances,
        weather,
        totalWalkingDistance,
        paceScore,
      };
    });

    // Get destination photos
    const photos = getDestinationPhotos(destination);

    console.log(`[enrich-itinerary] Enrichment complete for trip ${tripId}`);

    return new Response(
      JSON.stringify({
        success: true,
        tripId,
        days: enrichedDays,
        destinationPhotos: photos,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[enrich-itinerary] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Itinerary enrichment failed", code: "ENRICHMENT_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
