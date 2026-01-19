import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// TYPES
// =============================================================================

interface ActivityLocation {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

interface Activity {
  id: string;
  title: string;
  category?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  location?: ActivityLocation;
  cost?: { amount: number; currency: string };
  isLocked?: boolean;
  transportation?: {
    method: string;
    duration: string;
    distance?: string;
    estimatedCost?: { amount: number; currency: string };
    instructions?: string;
  };
}

interface Day {
  dayNumber: number;
  date?: string;
  activities: Activity[];
}

interface OptimizeRequest {
  tripId: string;
  destination: string;
  days: Day[];
  enableRouteOptimization?: boolean;
  enableRealTransport?: boolean;
  enableCostLookup?: boolean;
}

interface TransportResult {
  method: string;
  duration: string;
  durationMinutes: number;
  distance: string;
  distanceMeters: number;
  estimatedCost: { amount: number; currency: string };
  instructions: string;
}

// =============================================================================
// GOOGLE DISTANCE MATRIX API
// =============================================================================

async function getGoogleTransport(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: 'walking' | 'driving' | 'transit' = 'walking'
): Promise<TransportResult | null> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    console.warn("[optimize-itinerary] GOOGLE_MAPS_API_KEY not set, using fallback");
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=${mode}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      console.error("[optimize-itinerary] Distance Matrix error:", data.status);
      return null;
    }

    const element = data.rows[0].elements[0];
    if (element.status !== 'OK') {
      return null;
    }

    const distanceMeters = element.distance.value;
    const durationMinutes = Math.round(element.duration.value / 60);
    
    // Estimate cost based on mode
    let costAmount = 0;
    let displayMethod: string = mode;
    if (mode === 'walking') {
      costAmount = 0;
      displayMethod = 'walk';
    } else if (mode === 'transit') {
      costAmount = 3; // Average transit fare
      displayMethod = 'metro';
    } else if (mode === 'driving') {
      // Rideshare estimate: base + per km
      costAmount = Math.round(5 + (distanceMeters / 1000) * 1.5);
      displayMethod = 'uber';
    }

    return {
      method: displayMethod,
      duration: `${durationMinutes} min`,
      durationMinutes,
      distance: element.distance.text,
      distanceMeters,
      estimatedCost: { amount: costAmount, currency: 'USD' },
      instructions: `${mode === 'walking' ? 'Walk' : mode === 'transit' ? 'Take public transit' : 'Take a rideshare'} to ${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`,
    };
  } catch (error) {
    console.error("[optimize-itinerary] Google API error:", error);
    return null;
  }
}

// Fallback using Haversine when no API key
function getHaversineTransport(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): TransportResult {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (origin.lat * Math.PI) / 180;
  const φ2 = (destination.lat * Math.PI) / 180;
  const Δφ = ((destination.lat - origin.lat) * Math.PI) / 180;
  const Δλ = ((destination.lng - origin.lng) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = Math.round(R * c);

  // Determine best transport mode based on distance
  let method: string;
  let durationMinutes: number;
  let costAmount: number;

  if (distanceMeters < 1500) {
    // Under 1.5km = walk
    method = 'walk';
    durationMinutes = Math.round(distanceMeters / 80); // 80m/min walking
    costAmount = 0;
  } else if (distanceMeters < 5000) {
    // 1.5-5km = metro/bus
    method = 'metro';
    durationMinutes = Math.round(distanceMeters / 400) + 5; // 400m/min + 5 min wait
    costAmount = 3;
  } else {
    // Over 5km = rideshare
    method = 'uber';
    durationMinutes = Math.round(distanceMeters / 500) + 3; // 500m/min + pickup
    costAmount = Math.round(5 + (distanceMeters / 1000) * 1.5);
  }

  const distanceKm = distanceMeters / 1000;
  const distanceText = distanceKm < 1 ? `${distanceMeters}m` : `${distanceKm.toFixed(1)}km`;

  return {
    method,
    duration: `${durationMinutes} min`,
    durationMinutes,
    distance: distanceText,
    distanceMeters,
    estimatedCost: { amount: costAmount, currency: 'USD' },
    instructions: method === 'walk' 
      ? `Walk ${distanceText}` 
      : method === 'metro' 
        ? `Take public transit (${distanceText})` 
        : `Take a rideshare (${distanceText})`,
  };
}

// =============================================================================
// ROUTE OPTIMIZATION (Nearest Neighbor TSP)
// User can replace with custom algorithm
// =============================================================================

function optimizeDayRoute(activities: Activity[]): Activity[] {
  // Separate locked activities (must stay in place) from unlocked
  const lockedWithIndex = activities
    .map((act, idx) => ({ act, idx, isLocked: act.isLocked || false }))
    .filter(item => item.isLocked);
  
  const unlocked = activities.filter(act => !act.isLocked);
  
  // If no unlocked activities or no coordinates, return as-is
  if (unlocked.length <= 1) return activities;
  
  const hasCoords = unlocked.every(a => a.location?.lat && a.location?.lng);
  if (!hasCoords) {
    console.log("[optimize-itinerary] Missing coordinates, skipping route optimization");
    return activities;
  }

  // Simple nearest-neighbor TSP for unlocked activities
  const optimized: Activity[] = [];
  const remaining = [...unlocked];
  
  // Start with first unlocked activity
  let current = remaining.shift()!;
  optimized.push(current);
  
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const dist = getDistance(
        current.location!.lat!, current.location!.lng!,
        remaining[i].location!.lat!, remaining[i].location!.lng!
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    
    current = remaining.splice(nearestIdx, 1)[0];
    optimized.push(current);
  }

  // Merge locked activities back into their original positions
  const result: Activity[] = [];
  let optimizedIdx = 0;
  
  for (let i = 0; i < activities.length; i++) {
    const lockedItem = lockedWithIndex.find(l => l.idx === i);
    if (lockedItem) {
      result.push(lockedItem.act);
    } else if (optimizedIdx < optimized.length) {
      result.push(optimized[optimizedIdx++]);
    }
  }
  
  // Append any remaining optimized activities
  while (optimizedIdx < optimized.length) {
    result.push(optimized[optimizedIdx++]);
  }

  return result;
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =============================================================================
// COST LOOKUP (Foursquare)
// =============================================================================

async function lookupActivityCost(
  activity: Activity,
  destination: string
): Promise<{ amount: number; currency: string } | null> {
  const apiKey = Deno.env.get("FOURSQUARE_API_KEY");
  if (!apiKey) {
    console.warn("[optimize-itinerary] FOURSQUARE_API_KEY not set, skipping cost lookup");
    return null;
  }

  // Skip transport/accommodation - we handle those separately
  const category = (activity.category || activity.type || '').toLowerCase();
  if (['transport', 'transportation', 'accommodation'].includes(category)) {
    return null;
  }

  try {
    const query = encodeURIComponent(activity.title);
    const near = encodeURIComponent(destination);
    
    const url = `https://api.foursquare.com/v3/places/search?query=${query}&near=${near}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'Authorization': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn("[optimize-itinerary] Foursquare search failed:", response.status);
      return null;
    }

    const data = await response.json();
    const place = data.results?.[0];
    
    if (!place) return null;

    // Get place details for price
    const detailsUrl = `https://api.foursquare.com/v3/places/${place.fsq_id}?fields=price`;
    const detailsRes = await fetch(detailsUrl, {
      headers: { 'Authorization': apiKey, 'Accept': 'application/json' },
    });

    if (!detailsRes.ok) return null;

    const details = await detailsRes.json();
    const priceLevel = details.price; // 1-4 scale

    // Map price level to estimated cost
    const priceMappings: Record<number, number> = {
      1: 15,  // $
      2: 35,  // $$
      3: 75,  // $$$
      4: 150, // $$$$
    };

    if (priceLevel && priceMappings[priceLevel]) {
      return { amount: priceMappings[priceLevel], currency: 'USD' };
    }

    // Fallback: estimate based on category
    const categoryEstimates: Record<string, number> = {
      dining: 40,
      restaurant: 40,
      cultural: 20,
      sightseeing: 15,
      activity: 30,
      shopping: 50,
      relaxation: 60,
    };

    if (categoryEstimates[category]) {
      return { amount: categoryEstimates[category], currency: 'USD' };
    }

    return null;
  } catch (error) {
    console.error("[optimize-itinerary] Cost lookup error:", error);
    return null;
  }
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
      enableRouteOptimization = true,
      enableRealTransport = true,
      enableCostLookup = true,
    } = body;

    console.log(`[optimize-itinerary] Processing trip ${tripId}: ${days.length} days`);
    console.log(`[optimize-itinerary] Options: route=${enableRouteOptimization}, transport=${enableRealTransport}, cost=${enableCostLookup}`);

    const optimizedDays: Day[] = [];
    let totalActivitiesOptimized = 0;
    let transportCalculated = 0;
    let costsLookedUp = 0;

    for (const day of days) {
      let activities = [...day.activities];

      // Step 1: Route optimization
      if (enableRouteOptimization && activities.length > 2) {
        console.log(`[optimize-itinerary] Day ${day.dayNumber}: Optimizing route for ${activities.length} activities`);
        activities = optimizeDayRoute(activities);
        totalActivitiesOptimized += activities.length;
      }

      // Step 2: Calculate real transportation between activities
      if (enableRealTransport) {
        for (let i = 0; i < activities.length; i++) {
          if (i === 0) continue; // No transport to first activity
          
          const prev = activities[i - 1];
          const curr = activities[i];
          
          if (prev.location?.lat && prev.location?.lng && curr.location?.lat && curr.location?.lng) {
            const origin = { lat: prev.location.lat, lng: prev.location.lng };
            const dest = { lat: curr.location.lat, lng: curr.location.lng };
            
            // Try Google API first, fall back to Haversine
            let transport = await getGoogleTransport(origin, dest, 'walking');
            
            // If walking takes too long, try transit or driving
            if (transport && transport.durationMinutes > 25) {
              const transitTransport = await getGoogleTransport(origin, dest, 'transit');
              if (transitTransport && transitTransport.durationMinutes < transport.durationMinutes) {
                transport = transitTransport;
              }
            }
            
            if (!transport) {
              transport = getHaversineTransport(origin, dest);
            }
            
            activities[i] = {
              ...curr,
              transportation: {
                method: transport.method,
                duration: transport.duration,
                distance: transport.distance,
                estimatedCost: transport.estimatedCost,
                instructions: transport.instructions,
              },
            };
            transportCalculated++;
          }
        }
      }

      // Step 3: Look up real costs
      if (enableCostLookup) {
        for (let i = 0; i < activities.length; i++) {
          const activity = activities[i];
          
          // Only look up if cost is missing or zero
          if (!activity.cost?.amount || activity.cost.amount === 0) {
            const realCost = await lookupActivityCost(activity, destination);
            if (realCost) {
              activities[i] = { ...activity, cost: realCost };
              costsLookedUp++;
            }
          }
        }
      }

      optimizedDays.push({
        ...day,
        activities,
      });
    }

    console.log(`[optimize-itinerary] Complete: ${totalActivitiesOptimized} activities route-optimized, ${transportCalculated} transport legs calculated, ${costsLookedUp} costs looked up`);

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
        optimizationMetadata: {
          routeOptimized: enableRouteOptimization,
          realTransport: enableRealTransport,
          costLookup: enableCostLookup,
          activitiesOptimized: totalActivitiesOptimized,
          transportCalculated,
          costsLookedUp,
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
        metadata: {
          activitiesOptimized: totalActivitiesOptimized,
          transportCalculated,
          costsLookedUp,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[optimize-itinerary] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Optimization failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
