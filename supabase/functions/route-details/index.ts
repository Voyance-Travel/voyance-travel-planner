import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { googleRoutes } from "../_shared/google-api.ts";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination, mode: requestedMode } = await req.json();
    const mode = requestedMode || 'transit';

    if (!origin || !destination) {
      return new Response(JSON.stringify({ error: 'origin and destination are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('[route-details] GOOGLE_MAPS_API_KEY not set');
      return new Response(JSON.stringify({ steps: [], summary: 'Route details unavailable (no API key)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const costTracker = trackCost('route_details', 'google_routes');

    console.log(`[route-details] ${mode}: "${origin}" → "${destination}"`);

    // Map mode to Routes API travelMode enum
    const travelModeMap: Record<string, string> = {
      driving: 'DRIVE',
      transit: 'TRANSIT',
      walking: 'WALK',
      bicycling: 'BICYCLE',
    };
    const travelMode = travelModeMap[mode] || 'TRANSIT';

    // Build Routes API request body
    const routesRequestBody: Record<string, unknown> = {
      origin: { address: origin },
      destination: { address: destination },
      travelMode,
      languageCode: 'en-US',
      units: 'IMPERIAL',
    };

    // Add departure time for transit and drive
    if (travelMode === 'TRANSIT' || travelMode === 'DRIVE') {
      routesRequestBody.departureTime = new Date().toISOString();
    }

    // For transit, request transit-specific details
    if (travelMode === 'TRANSIT') {
      routesRequestBody.transitPreferences = {
        routingPreference: 'FEWER_TRANSFERS',
      };
    }

    // Field mask — request legs with steps and transit details
    const fieldMask = [
      'routes.legs.duration',
      'routes.legs.distanceMeters',
      'routes.legs.steps.navigationInstruction',
      'routes.legs.steps.localizedValues',
      'routes.legs.steps.travelMode',
      'routes.legs.steps.transitDetails',
    ].join(',');

    const routesResult = await googleRoutes(
      { body: routesRequestBody, fieldMask },
      { tracker: costTracker, actionType: 'route_details', reason: `${mode}: ${origin} → ${destination}` },
    );

    if (!routesResult.ok) {
      console.error(`[route-details] Routes API request failed: ${routesResult.status} ${routesResult.errorText ?? ''}`);
      await costTracker.save();
      return new Response(JSON.stringify({
        steps: [], summary: 'Route details unavailable',
        totalDuration: '', totalDistance: '',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = routesResult.data;

    // Check for API error
    if (data.error) {
      console.error(`[route-details] Routes API error: ${data.error.code} - ${data.error.message}`);
      return new Response(JSON.stringify({
        steps: [],
        summary: 'Route not available',
        totalDuration: '',
        totalDistance: '',
        googleError: data.error.message,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data.routes?.[0]?.legs?.[0]) {
      console.log('[route-details] No routes returned');
      return new Response(JSON.stringify({
        steps: [],
        summary: 'No route found for this mode of transport',
        totalDuration: '',
        totalDistance: '',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const leg = data.routes[0].legs[0];
    const rawSteps = leg.steps || [];

    interface FormattedStep {
      instruction: string;
      distance: string;
      duration: string;
      travelMode: string;
      transitDetails?: {
        lineName: string;
        vehicleType: string;
        departureStop: string;
        arrivalStop: string;
        numStops: number;
      };
    }

    const formattedSteps: FormattedStep[] = [];

    for (const step of rawSteps) {
      const stepTravelMode = step.travelMode || 'WALK';
      const instruction = step.navigationInstruction?.instructions || '';
      const distance = step.localizedValues?.distance?.text || '';
      const duration = step.localizedValues?.duration?.text || '';

      const formatted: FormattedStep = {
        instruction,
        distance,
        duration,
        travelMode: stepTravelMode,
      };

      if (stepTravelMode === 'TRANSIT' && step.transitDetails) {
        const td = step.transitDetails;
        const line = td.transitLine || {};
        const vehicle = line.vehicle || {};

        formatted.transitDetails = {
          lineName: line.nameShort || line.name || '',
          vehicleType: vehicle.type || 'TRANSIT',
          departureStop: td.stopDetails?.departureStop?.name || '',
          arrivalStop: td.stopDetails?.arrivalStop?.name || '',
          numStops: td.stopCount || 0,
        };
      }

      formattedSteps.push(formatted);
    }

    // Build human-readable summary
    const summaryParts: string[] = [];
    for (const step of formattedSteps) {
      if (step.travelMode === 'WALK' && step.duration) {
        summaryParts.push(`Walk ${step.duration} (${step.distance})`);
      } else if (step.travelMode === 'TRANSIT' && step.transitDetails) {
        const td = step.transitDetails;
        const vehicleLabel = td.vehicleType === 'SUBWAY' || td.vehicleType === 'METRO_RAIL' ? 'Metro'
          : td.vehicleType === 'BUS' ? 'Bus'
          : td.vehicleType === 'TRAM' ? 'Tram'
          : td.vehicleType === 'RAIL' || td.vehicleType === 'HEAVY_RAIL' ? 'Train'
          : td.vehicleType === 'COMMUTER_TRAIN' ? 'Commuter Train'
          : 'Transit';
        const lineLabel = td.lineName ? `${td.lineName} ${vehicleLabel}` : vehicleLabel;
        const stopInfo = td.numStops > 0 ? ` (${td.numStops} stop${td.numStops > 1 ? 's' : ''})` : '';
        summaryParts.push(`Take ${lineLabel} from ${td.departureStop} to ${td.arrivalStop}${stopInfo}`);
      } else if (step.travelMode === 'DRIVE') {
        summaryParts.push(step.instruction);
      }
    }

    // Parse total duration from leg
    const durationSeconds = parseInt(leg.duration?.replace('s', '') || '0', 10);
    const durationMins = Math.round(durationSeconds / 60);
    const totalDuration = durationMins >= 60
      ? `${Math.floor(durationMins / 60)} hr ${durationMins % 60} min`
      : `${durationMins} min`;

    // Parse total distance
    const distanceMeters = leg.distanceMeters || 0;
    const distanceMiles = (distanceMeters / 1609.34).toFixed(1);
    const totalDistance = distanceMeters >= 1609 ? `${distanceMiles} mi` : `${distanceMeters} m`;

    console.log(`[route-details] Returning ${formattedSteps.length} steps, ${totalDuration}`);

    await costTracker.save();
    return new Response(JSON.stringify({
      steps: formattedSteps,
      summary: summaryParts.join(' → '),
      totalDuration,
      totalDistance,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[route-details] Error:', error);
    return new Response(JSON.stringify({ error: 'Route lookup failed', details: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
