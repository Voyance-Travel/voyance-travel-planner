import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferRequest {
  origin: string;      // Airport name or code (e.g., "FCO" or "Rome Fiumicino Airport")
  destination: string; // Hotel address or city center
  arrivalTime?: string; // ISO date string for departure time
}

interface TransferOption {
  mode: string;
  duration: string;
  durationMinutes: number;
  estimatedCost?: string;
  notes?: string;
}

interface TransferResponse {
  origin: string;
  destination: string;
  options: TransferOption[];
  fetchedAt: string;
}

// Cost estimates by mode and region (since Distance Matrix doesn't provide pricing)
const getCostEstimate = (mode: string, durationMinutes: number, destination: string): string => {
  const destLower = destination.toLowerCase();
  
  // Regional cost multipliers based on typical taxi/transit costs
  const regions: Record<string, { taxiPerMin: number; transitBase: number; currency: string }> = {
    // Europe
    'rome': { taxiPerMin: 0.9, transitBase: 14, currency: '€' },
    'paris': { taxiPerMin: 1.1, transitBase: 11, currency: '€' },
    'london': { taxiPerMin: 1.5, transitBase: 25, currency: '£' },
    'barcelona': { taxiPerMin: 0.8, transitBase: 5, currency: '€' },
    'amsterdam': { taxiPerMin: 1.0, transitBase: 6, currency: '€' },
    'berlin': { taxiPerMin: 0.8, transitBase: 4, currency: '€' },
    'vienna': { taxiPerMin: 0.9, transitBase: 5, currency: '€' },
    'prague': { taxiPerMin: 0.5, transitBase: 2, currency: '€' },
    'lisbon': { taxiPerMin: 0.6, transitBase: 4, currency: '€' },
    'athens': { taxiPerMin: 0.7, transitBase: 10, currency: '€' },
    'milan': { taxiPerMin: 1.1, transitBase: 13, currency: '€' },
    'florence': { taxiPerMin: 0.7, transitBase: 6, currency: '€' },
    'venice': { taxiPerMin: 1.2, transitBase: 15, currency: '€' },
    'nice': { taxiPerMin: 0.9, transitBase: 6, currency: '€' },
    'madrid': { taxiPerMin: 0.7, transitBase: 5, currency: '€' },
    
    // Asia
    'tokyo': { taxiPerMin: 3.5, transitBase: 25, currency: '¥' },
    'kyoto': { taxiPerMin: 3.0, transitBase: 24, currency: '¥' },
    'singapore': { taxiPerMin: 0.6, transitBase: 3, currency: 'S$' },
    'bangkok': { taxiPerMin: 0.3, transitBase: 1.5, currency: '$' },
    'bali': { taxiPerMin: 0.4, transitBase: 0, currency: '$' },
    'hong kong': { taxiPerMin: 0.5, transitBase: 1.5, currency: '$' },
    'seoul': { taxiPerMin: 0.8, transitBase: 15, currency: '$' },
    
    // Americas
    'new york': { taxiPerMin: 1.2, transitBase: 11, currency: '$' },
    'los angeles': { taxiPerMin: 1.0, transitBase: 10, currency: '$' },
    'miami': { taxiPerMin: 0.9, transitBase: 2.5, currency: '$' },
    'san francisco': { taxiPerMin: 1.1, transitBase: 10, currency: '$' },
    'chicago': { taxiPerMin: 0.9, transitBase: 5, currency: '$' },
    'las vegas': { taxiPerMin: 0.8, transitBase: 0, currency: '$' },
    'mexico city': { taxiPerMin: 0.4, transitBase: 0.5, currency: '$' },
    'cancun': { taxiPerMin: 0.5, transitBase: 0, currency: '$' },
    
    // Default
    'default': { taxiPerMin: 1.0, transitBase: 10, currency: '$' },
  };
  
  // Find matching region
  let regionData = regions['default'];
  for (const [city, data] of Object.entries(regions)) {
    if (destLower.includes(city)) {
      regionData = data;
      break;
    }
  }
  
  const { taxiPerMin, transitBase, currency } = regionData;
  
  switch (mode) {
    case 'driving':
      // Taxi cost = base + per minute
      const taxiCost = Math.round(10 + (durationMinutes * taxiPerMin));
      return `${currency}${taxiCost}-${Math.round(taxiCost * 1.3)}`;
    case 'transit':
      if (transitBase === 0) return 'N/A';
      return `${currency}${transitBase}`;
    default:
      return 'Varies';
  }
};

const formatDuration = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination, arrivalTime } = await req.json() as TransferRequest;
    
    if (!origin || !destination) {
      return new Response(
        JSON.stringify({ error: 'Origin and destination are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('GOOGLE_MAPS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const options: TransferOption[] = [];
    const modes = ['driving', 'transit'];
    
    // Fetch data for each travel mode
    for (const mode of modes) {
      try {
        const params = new URLSearchParams({
          origins: origin,
          destinations: destination,
          mode: mode,
          key: GOOGLE_MAPS_API_KEY,
        });
        
        // Add departure time for transit (required for accurate results)
        if (arrivalTime) {
          const departureTime = Math.floor(new Date(arrivalTime).getTime() / 1000);
          params.append('departure_time', departureTime.toString());
        } else {
          // Use "now" for real-time traffic
          params.append('departure_time', 'now');
        }

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`
        );
        
        const data = await response.json();
        
        if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
          const element = data.rows[0].elements[0];
          const durationSeconds = element.duration_in_traffic?.value || element.duration.value;
          const durationMinutes = Math.round(durationSeconds / 60);
          
          const modeLabel = mode === 'driving' ? 'Taxi/Rideshare' : 'Train/Bus';
          
          options.push({
            mode: modeLabel,
            duration: formatDuration(durationSeconds),
            durationMinutes,
            estimatedCost: getCostEstimate(mode, durationMinutes, destination),
            notes: mode === 'driving' && element.duration_in_traffic 
              ? 'Includes current traffic' 
              : undefined,
          });
        } else if (mode === 'transit' && data.rows?.[0]?.elements?.[0]?.status === 'ZERO_RESULTS') {
          // No transit available
          options.push({
            mode: 'Train/Bus',
            duration: 'N/A',
            durationMinutes: 0,
            estimatedCost: 'N/A',
            notes: 'No public transit route found',
          });
        }
      } catch (modeError) {
        console.error(`Error fetching ${mode} data:`, modeError);
      }
    }

    // Ensure we have at least some data
    if (options.length === 0) {
      options.push(
        { mode: 'Taxi/Rideshare', duration: '30-50 min', durationMinutes: 40, estimatedCost: 'Varies' },
        { mode: 'Train/Bus', duration: '30-45 min', durationMinutes: 37, estimatedCost: 'Varies' }
      );
    }

    const result: TransferResponse = {
      origin,
      destination,
      options,
      fetchedAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Airport transfers error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
