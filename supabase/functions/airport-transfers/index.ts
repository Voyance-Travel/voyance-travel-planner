import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferRequest {
  origin: string;      // Airport name or code (e.g., "FCO" or "Rome Fiumicino Airport")
  destination: string; // Hotel address or city center
  city: string;        // City name for fare lookup
  airportCode?: string; // Optional airport code for more specific lookup
  arrivalTime?: string; // ISO date string for departure time
}

interface TransferOption {
  mode: string;
  duration: string;
  durationMinutes: number;
  estimatedCost: string;
  notes?: string;
  trainLine?: string;
}

interface TransferResponse {
  origin: string;
  destination: string;
  options: TransferOption[];
  source: 'database' | 'estimated';
  lastVerified?: string;
  fetchedAt: string;
}

interface FareRecord {
  city: string;
  airport_code: string;
  airport_name: string;
  taxi_duration_min: number | null;
  taxi_duration_max: number | null;
  taxi_cost_min: number | null;
  taxi_cost_max: number | null;
  taxi_is_fixed_price: boolean;
  taxi_notes: string | null;
  train_duration_min: number | null;
  train_duration_max: number | null;
  train_cost: number | null;
  train_line: string | null;
  train_notes: string | null;
  currency: string;
  currency_symbol: string;
  last_verified_at: string;
  source: string;
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
};

const formatDurationRange = (min: number | null, max: number | null): string => {
  if (min === null && max === null) return 'N/A';
  if (min === max || max === null) return `${min} min`;
  if (min === null) return `${max} min`;
  return `${min}-${max} min`;
};

const formatCost = (min: number | null, max: number | null, symbol: string, isFixed: boolean): string => {
  if (min === null && max === null) return 'N/A';
  if (isFixed || min === max) return `${symbol}${min} fixed`;
  if (min === null) return `${symbol}${max}`;
  if (max === null) return `${symbol}${min}`;
  return `${symbol}${min}-${max}`;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination, city, airportCode, arrivalTime } = await req.json() as TransferRequest;
    
    if (!city) {
      return new Response(
        JSON.stringify({ error: 'City is required for fare lookup' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up fare data from database
    let fareQuery = supabase
      .from('airport_transfer_fares')
      .select('*')
      .ilike('city', city);
    
    // If airport code provided, filter by it
    if (airportCode) {
      fareQuery = fareQuery.eq('airport_code', airportCode.toUpperCase());
    }

    const { data: fares, error: fareError } = await fareQuery.limit(1);
    
    if (fareError) {
      console.error('Database lookup error:', fareError);
    }

    const fareRecord = fares?.[0] as FareRecord | undefined;
    
    // Also fetch live duration from Google Maps if configured
    let liveTaxiDuration: string | null = null;
    let liveTransitDuration: string | null = null;
    
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    
    if (GOOGLE_MAPS_API_KEY && origin && destination) {
      // Fetch driving duration
      try {
        const drivingParams = new URLSearchParams({
          origins: origin,
          destinations: destination,
          mode: 'driving',
          departure_time: 'now',
          key: GOOGLE_MAPS_API_KEY,
        });
        
        const drivingResp = await fetch(
          `https://maps.googleapis.com/maps/api/distancematrix/json?${drivingParams.toString()}`
        );
        const drivingData = await drivingResp.json();
        
        if (drivingData.status === 'OK' && drivingData.rows?.[0]?.elements?.[0]?.status === 'OK') {
          const element = drivingData.rows[0].elements[0];
          const seconds = element.duration_in_traffic?.value || element.duration.value;
          liveTaxiDuration = formatDuration(seconds);
        }
      } catch (e) {
        console.error('Google Maps driving lookup failed:', e);
      }

      // Fetch transit duration
      try {
        const transitParams = new URLSearchParams({
          origins: origin,
          destinations: destination,
          mode: 'transit',
          departure_time: arrivalTime 
            ? Math.floor(new Date(arrivalTime).getTime() / 1000).toString()
            : 'now',
          key: GOOGLE_MAPS_API_KEY,
        });
        
        const transitResp = await fetch(
          `https://maps.googleapis.com/maps/api/distancematrix/json?${transitParams.toString()}`
        );
        const transitData = await transitResp.json();
        
        if (transitData.status === 'OK' && transitData.rows?.[0]?.elements?.[0]?.status === 'OK') {
          const element = transitData.rows[0].elements[0];
          const seconds = element.duration.value;
          liveTransitDuration = formatDuration(seconds);
        }
      } catch (e) {
        console.error('Google Maps transit lookup failed:', e);
      }
    }

    const options: TransferOption[] = [];
    
    if (fareRecord) {
      // Use curated database fares with live duration if available
      const symbol = fareRecord.currency_symbol;
      
      // Taxi option
      const taxiDuration = liveTaxiDuration || formatDurationRange(
        fareRecord.taxi_duration_min, 
        fareRecord.taxi_duration_max
      );
      
      options.push({
        mode: 'Taxi/Rideshare',
        duration: taxiDuration,
        durationMinutes: fareRecord.taxi_duration_max || fareRecord.taxi_duration_min || 40,
        estimatedCost: formatCost(
          fareRecord.taxi_cost_min, 
          fareRecord.taxi_cost_max, 
          symbol, 
          fareRecord.taxi_is_fixed_price
        ),
        notes: liveTaxiDuration 
          ? `Live traffic • ${fareRecord.taxi_notes || ''}`
          : fareRecord.taxi_notes || undefined,
      });
      
      // Train option
      if (fareRecord.train_cost !== null) {
        const trainDuration = liveTransitDuration || formatDurationRange(
          fareRecord.train_duration_min, 
          fareRecord.train_duration_max
        );
        
        options.push({
          mode: 'Train/Metro',
          duration: trainDuration,
          durationMinutes: fareRecord.train_duration_max || fareRecord.train_duration_min || 35,
          estimatedCost: `${symbol}${fareRecord.train_cost}`,
          trainLine: fareRecord.train_line || undefined,
          notes: fareRecord.train_notes || undefined,
        });
      } else {
        options.push({
          mode: 'Train/Metro',
          duration: 'N/A',
          durationMinutes: 0,
          estimatedCost: 'N/A',
          notes: fareRecord.train_notes || 'No train service',
        });
      }
    } else {
      // Fallback: Use Google Maps duration with estimated costs
      options.push({
        mode: 'Taxi/Rideshare',
        duration: liveTaxiDuration || '30-50 min',
        durationMinutes: 40,
        estimatedCost: 'Varies by city',
        notes: liveTaxiDuration ? 'Live traffic' : undefined,
      });
      
      options.push({
        mode: 'Train/Metro',
        duration: liveTransitDuration || '30-45 min',
        durationMinutes: 35,
        estimatedCost: 'Check locally',
      });
    }

    const result: TransferResponse = {
      origin: origin || `${city} Airport`,
      destination: destination || city,
      options,
      source: fareRecord ? 'database' : 'estimated',
      lastVerified: fareRecord?.last_verified_at,
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
