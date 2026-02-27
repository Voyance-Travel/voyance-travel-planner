/**
 * transit-estimate — Lightweight edge function to estimate transit between two locations.
 * Returns walking, transit, and taxi estimates using Google Routes/Directions API.
 * 
 * POST { origin: { lat, lng } | string, destination: { lat, lng } | string }
 * Returns { estimates: { walking, transit, taxi } }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LatLng { lat: number; lng: number }
type LocationInput = LatLng | string;

interface TransitEstimate {
  method: string;
  duration: string;
  durationMinutes: number;
  distance: string;
  distanceMeters: number;
  estimatedCost: { amount: number; currency: string } | null;
  recommended?: boolean;
}

function toRoutesApiLocation(loc: LocationInput) {
  if (typeof loc === 'string') return { address: loc };
  return { location: { latLng: { latitude: loc.lat, longitude: loc.lng } } };
}

function parseGoogleDuration(durationStr: string | null | undefined): number {
  if (!durationStr) return 0;
  const match = durationStr.match(/(\d+)s/);
  return match ? Math.ceil(parseInt(match[1]) / 60) : 0;
}

function metersToText(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// Haversine distance for fallback
function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function heuristicEstimates(distMeters: number): TransitEstimate[] {
  const walkMinutes = Math.ceil(distMeters / 80); // ~5km/h
  const transitMinutes = Math.max(5, Math.ceil(distMeters / 500) + 5); // rough metro estimate
  const taxiMinutes = Math.max(3, Math.ceil(distMeters / 400)); // ~24km/h city driving
  const taxiCost = Math.max(3, Math.round(distMeters / 1000 * 2));
  const distText = metersToText(distMeters);

  const results: TransitEstimate[] = [];

  results.push({
    method: 'walking',
    duration: `${walkMinutes} min`,
    durationMinutes: walkMinutes,
    distance: distText,
    distanceMeters: distMeters,
    estimatedCost: null,
    recommended: walkMinutes <= 15,
  });

  if (walkMinutes > 10) {
    results.push({
      method: 'transit',
      duration: `${transitMinutes} min`,
      durationMinutes: transitMinutes,
      distance: distText,
      distanceMeters: distMeters,
      estimatedCost: { amount: Math.min(5, Math.max(2, Math.round(distMeters / 5000) + 2)), currency: 'USD' },
      recommended: walkMinutes > 15 && distMeters < 15000,
    });
  }

  if (walkMinutes > 15) {
    results.push({
      method: 'taxi',
      duration: `${taxiMinutes} min`,
      durationMinutes: taxiMinutes,
      distance: distText,
      distanceMeters: distMeters,
      estimatedCost: { amount: taxiCost, currency: 'USD' },
      recommended: distMeters >= 15000,
    });
  }

  return results;
}

async function fetchGoogleRoute(
  origin: LocationInput,
  destination: LocationInput,
  travelMode: string,
  apiKey: string
): Promise<TransitEstimate | null> {
  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const body = {
      origin: toRoutesApiLocation(origin),
      destination: toRoutesApiLocation(destination),
      travelMode,
      computeAlternativeRoutes: false,
      languageCode: 'en-US',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;

    const distMeters = Number(route.distanceMeters || 0);
    const durMinutes = parseGoogleDuration(route.duration);

    const methodMap: Record<string, string> = {
      WALK: 'walking',
      TRANSIT: 'transit',
      DRIVE: 'taxi',
    };

    let cost: { amount: number; currency: string } | null = null;
    if (travelMode === 'DRIVE') {
      cost = { amount: Math.max(3, Math.round(distMeters / 1000 * 2)), currency: 'USD' };
    } else if (travelMode === 'TRANSIT') {
      cost = { amount: Math.min(5, Math.max(2, Math.round(distMeters / 5000) + 2)), currency: 'USD' };
    }

    return {
      method: methodMap[travelMode] || travelMode.toLowerCase(),
      duration: `${durMinutes} min`,
      durationMinutes: durMinutes,
      distance: metersToText(distMeters),
      distanceMeters: distMeters,
      estimatedCost: cost,
    };
  } catch (e) {
    console.error(`[transit-estimate] ${travelMode} error:`, e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination } = await req.json();

    if (!origin || !destination) {
      return new Response(JSON.stringify({ error: 'origin and destination required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GOOGLE_ROUTES_API_KEY') || Deno.env.get('GOOGLE_MAPS_API_KEY');

    // If we have coords for both, compute haversine for fallback
    let fallbackDistance: number | null = null;
    if (typeof origin !== 'string' && typeof destination !== 'string') {
      fallbackDistance = haversineDistance(origin, destination);
    }

    if (!apiKey) {
      // No API key — return heuristic estimates based on haversine
      if (fallbackDistance !== null) {
        return new Response(JSON.stringify({ estimates: heuristicEstimates(fallbackDistance), source: 'heuristic' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ estimates: [], source: 'none', error: 'No coordinates or API key' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch walking and driving in parallel; only add transit if distance > 800m
    const shouldFetchTransit = fallbackDistance === null || fallbackDistance > 800;

    const promises = [
      fetchGoogleRoute(origin, destination, 'WALK', apiKey),
      fetchGoogleRoute(origin, destination, 'DRIVE', apiKey),
      ...(shouldFetchTransit ? [fetchGoogleRoute(origin, destination, 'TRANSIT', apiKey)] : []),
    ];

    const [walkResult, driveResult, transitResult] = await Promise.all(promises);

    const estimates: TransitEstimate[] = [];

    if (walkResult) {
      walkResult.recommended = walkResult.durationMinutes <= 15;
      estimates.push(walkResult);
    }

    if (transitResult) {
      transitResult.recommended = (walkResult?.durationMinutes ?? 999) > 15 && transitResult.durationMinutes < (driveResult?.durationMinutes ?? 999) * 1.5;
      estimates.push(transitResult);
    }

    if (driveResult) {
      driveResult.recommended = (walkResult?.durationMinutes ?? 999) > 15 && !transitResult?.recommended;
      estimates.push(driveResult);
    }

    // Fallback to heuristics if all API calls failed
    if (estimates.length === 0 && fallbackDistance !== null) {
      return new Response(JSON.stringify({ estimates: heuristicEstimates(fallbackDistance), source: 'heuristic' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ estimates, source: 'google' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[transit-estimate] Error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
