import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    console.log(`[route-details] ${mode}: "${origin}" → "${destination}"`);

    const params: Record<string, string> = {
      origin,
      destination,
      mode,
      key: GOOGLE_MAPS_API_KEY,
    };

    // departure_time is only valid for driving and transit, NOT walking
    if (mode === 'driving' || mode === 'transit') {
      params.departure_time = 'now';
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${new URLSearchParams(params)}`;
    const resp = await fetch(url);
    const data = await resp.json();

    console.log(`[route-details] Google status: ${data.status}, error_message: ${data.error_message || 'none'}`);

    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
      return new Response(JSON.stringify({
        steps: [],
        summary: data.status === 'ZERO_RESULTS'
          ? 'No route found for this mode of transport'
          : 'Route not available',
        totalDuration: '',
        totalDistance: '',
        googleStatus: data.status,
        errorMessage: data.error_message || null,
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
      const travelMode = step.travel_mode || 'WALKING';
      const instruction = (step.html_instructions || '').replace(/<[^>]*>/g, '');

      const formatted: FormattedStep = {
        instruction,
        distance: step.distance?.text || '',
        duration: step.duration?.text || '',
        travelMode,
      };

      if (travelMode === 'TRANSIT' && step.transit_details) {
        const td = step.transit_details;
        formatted.transitDetails = {
          lineName: td.line?.short_name || td.line?.name || '',
          vehicleType: td.line?.vehicle?.type || 'TRANSIT',
          departureStop: td.departure_stop?.name || '',
          arrivalStop: td.arrival_stop?.name || '',
          numStops: td.num_stops || 0,
        };
      }

      formattedSteps.push(formatted);
    }

    // Build human-readable summary
    const summaryParts: string[] = [];
    for (const step of formattedSteps) {
      if (step.travelMode === 'WALKING' && step.duration) {
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
      } else if (step.travelMode === 'DRIVING') {
        summaryParts.push(step.instruction);
      }
    }

    console.log(`[route-details] Returning ${formattedSteps.length} steps, ${leg.duration?.text}`);

    return new Response(JSON.stringify({
      steps: formattedSteps,
      summary: summaryParts.join(' → '),
      totalDuration: leg.duration?.text || '',
      totalDistance: leg.distance?.text || '',
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
