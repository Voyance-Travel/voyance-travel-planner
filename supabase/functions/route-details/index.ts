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
    const { origin, destination, mode } = await req.json();

    if (!origin || !destination || !mode) {
      return new Response(JSON.stringify({ error: 'Missing origin, destination, or mode' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ steps: [], summary: 'Route details unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const params = new URLSearchParams({
      origin,
      destination,
      mode, // 'driving', 'transit', 'walking'
      departure_time: 'now',
      key: GOOGLE_MAPS_API_KEY,
    });

    const resp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
    const data = await resp.json();

    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
      return new Response(JSON.stringify({ steps: [], summary: 'Route not available' }), {
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

    return new Response(JSON.stringify({
      steps: formattedSteps,
      summary: summaryParts.join(' → '),
      totalDuration: leg.duration?.text || '',
      totalDistance: leg.distance?.text || '',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Route details error:', error);
    return new Response(JSON.stringify({ error: 'Route lookup failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
