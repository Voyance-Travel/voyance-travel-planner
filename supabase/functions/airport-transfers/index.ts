import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

// Regional transfer cost estimates for cities not in the database
// Based on typical airport-to-city-center fares by region
interface RegionalEstimate {
  taxiMin: number; taxiMax: number;
  trainCost: number | null;
  symbol: string;
  taxiDuration: string;
  trainDuration: string | null;
}

const REGIONAL_ESTIMATES: Record<string, RegionalEstimate> = {
  // Latin America
  'mexico': { taxiMin: 15, taxiMax: 30, trainCost: 1, symbol: '$', taxiDuration: '30-50 min', trainDuration: '40-60 min' },
  'colombia': { taxiMin: 10, taxiMax: 25, trainCost: null, symbol: '$', taxiDuration: '40-70 min', trainDuration: null },
  'brazil': { taxiMin: 20, taxiMax: 40, trainCost: 2, symbol: 'R$', taxiDuration: '30-60 min', trainDuration: '40-60 min' },
  'argentina': { taxiMin: 15, taxiMax: 30, trainCost: 1, symbol: '$', taxiDuration: '30-50 min', trainDuration: '45 min' },
  'peru': { taxiMin: 8, taxiMax: 20, trainCost: null, symbol: 'S/', taxiDuration: '30-50 min', trainDuration: null },
  'chile': { taxiMin: 15, taxiMax: 30, trainCost: 2, symbol: '$', taxiDuration: '25-40 min', trainDuration: '30 min' },
  'costa rica': { taxiMin: 25, taxiMax: 45, trainCost: null, symbol: '$', taxiDuration: '20-40 min', trainDuration: null },
  // Europe
  'europe_default': { taxiMin: 30, taxiMax: 60, trainCost: 10, symbol: '€', taxiDuration: '30-50 min', trainDuration: '30-45 min' },
  'uk': { taxiMin: 40, taxiMax: 80, trainCost: 15, symbol: '£', taxiDuration: '30-60 min', trainDuration: '30-45 min' },
  'scandinavia': { taxiMin: 40, taxiMax: 80, trainCost: 12, symbol: '€', taxiDuration: '25-40 min', trainDuration: '20-35 min' },
  'eastern_europe': { taxiMin: 10, taxiMax: 25, trainCost: 3, symbol: '€', taxiDuration: '25-45 min', trainDuration: '30-45 min' },
  // Asia
  'southeast_asia': { taxiMin: 5, taxiMax: 15, trainCost: 2, symbol: '$', taxiDuration: '30-60 min', trainDuration: '30-45 min' },
  'japan': { taxiMin: 60, taxiMax: 200, trainCost: 30, symbol: '¥', taxiDuration: '45-90 min', trainDuration: '35-60 min' },
  'india': { taxiMin: 8, taxiMax: 20, trainCost: 1, symbol: '₹', taxiDuration: '30-60 min', trainDuration: '40-60 min' },
  'china': { taxiMin: 15, taxiMax: 35, trainCost: 5, symbol: '¥', taxiDuration: '30-50 min', trainDuration: '20-40 min' },
  // Africa
  'africa': { taxiMin: 10, taxiMax: 30, trainCost: null, symbol: '$', taxiDuration: '25-50 min', trainDuration: null },
  'south_africa': { taxiMin: 15, taxiMax: 35, trainCost: 5, symbol: 'R', taxiDuration: '25-40 min', trainDuration: '30 min' },
  'morocco': { taxiMin: 10, taxiMax: 25, trainCost: 3, symbol: 'MAD ', taxiDuration: '20-40 min', trainDuration: '30-45 min' },
  // Middle East
  'middle_east': { taxiMin: 15, taxiMax: 40, trainCost: 5, symbol: '$', taxiDuration: '20-40 min', trainDuration: '25-40 min' },
  // Oceania
  'australia': { taxiMin: 40, taxiMax: 80, trainCost: 15, symbol: 'A$', taxiDuration: '25-45 min', trainDuration: '30-45 min' },
  'new_zealand': { taxiMin: 30, taxiMax: 60, trainCost: null, symbol: 'NZ$', taxiDuration: '25-40 min', trainDuration: null },
  // Default
  'default': { taxiMin: 20, taxiMax: 50, trainCost: 5, symbol: '$', taxiDuration: '30-50 min', trainDuration: '30-45 min' },
};

// Map city/country to region for cost estimation
const CITY_REGION_MAP: Record<string, string> = {
  // Latin America cities
  'bogota': 'colombia', 'medellin': 'colombia', 'cartagena': 'colombia',
  'mexico city': 'mexico', 'cancun': 'mexico', 'cabo san lucas': 'mexico', 'oaxaca': 'mexico', 'playa del carmen': 'mexico', 'tulum': 'mexico',
  'rio de janeiro': 'brazil', 'sao paulo': 'brazil',
  'buenos aires': 'argentina',
  'lima': 'peru', 'cusco': 'peru',
  'santiago': 'chile',
  'san jose': 'costa rica',
  // Europe
  'edinburgh': 'uk', 'dublin': 'europe_default', 'manchester': 'uk',
  'stockholm': 'scandinavia', 'copenhagen': 'scandinavia', 'oslo': 'scandinavia', 'helsinki': 'scandinavia',
  'prague': 'eastern_europe', 'budapest': 'eastern_europe', 'krakow': 'eastern_europe', 'warsaw': 'eastern_europe', 'bucharest': 'eastern_europe',
  'amsterdam': 'europe_default', 'brussels': 'europe_default', 'vienna': 'europe_default', 'zurich': 'europe_default',
  'lisbon': 'europe_default', 'porto': 'europe_default',
  'berlin': 'europe_default', 'munich': 'europe_default',
  'santorini': 'europe_default', 'mykonos': 'europe_default',
  // Asia
  'hanoi': 'southeast_asia', 'ho chi minh': 'southeast_asia', 'saigon': 'southeast_asia',
  'kuala lumpur': 'southeast_asia', 'phuket': 'southeast_asia', 'chiang mai': 'southeast_asia',
  'manila': 'southeast_asia', 'jakarta': 'southeast_asia',
  'kyoto': 'japan', 'osaka': 'japan',
  'mumbai': 'india', 'delhi': 'india', 'new delhi': 'india', 'jaipur': 'india', 'goa': 'india',
  'shanghai': 'china', 'beijing': 'china',
  // Africa
  'cape town': 'south_africa', 'johannesburg': 'south_africa',
  'marrakech': 'morocco', 'fez': 'morocco', 'casablanca': 'morocco',
  'nairobi': 'africa', 'cairo': 'africa', 'accra': 'africa', 'lagos': 'africa',
  'inhambane': 'africa', 'maputo': 'africa',
  // Middle East
  'amman': 'middle_east', 'doha': 'middle_east', 'muscat': 'middle_east', 'tel aviv': 'middle_east', 'istanbul': 'middle_east',
  // Oceania
  'sydney': 'australia', 'melbourne': 'australia', 'brisbane': 'australia',
  'auckland': 'new_zealand', 'queenstown': 'new_zealand',
  // US cities not in DB
  'austin': 'default', 'nashville': 'default', 'denver': 'default', 'seattle': 'default',
  'portland': 'default', 'boston': 'default', 'atlanta': 'default', 'new orleans': 'default',
  'washington dc': 'default', 'philadelphia': 'default', 'san diego': 'default', 'honolulu': 'default',
};

function getRegionalEstimate(city: string): RegionalEstimate {
  const cityLower = city.toLowerCase().trim();
  const regionKey = CITY_REGION_MAP[cityLower];
  if (regionKey && REGIONAL_ESTIMATES[regionKey]) {
    return REGIONAL_ESTIMATES[regionKey];
  }
  // Fuzzy match
  for (const [key, region] of Object.entries(CITY_REGION_MAP)) {
    if (cityLower.includes(key) || key.includes(cityLower)) {
      return REGIONAL_ESTIMATES[region] || REGIONAL_ESTIMATES['default'];
    }
  }
  return REGIONAL_ESTIMATES['default'];
}


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
      // Fallback: Use regional estimates with Google Maps duration if available
      const regional = getRegionalEstimate(city);
      
      options.push({
        mode: 'Taxi/Rideshare',
        duration: liveTaxiDuration || regional.taxiDuration,
        durationMinutes: 40,
        estimatedCost: `${regional.symbol}${regional.taxiMin}-${regional.taxiMax}`,
        notes: liveTaxiDuration ? 'Live traffic estimate' : 'Regional estimate',
      });
      
      if (regional.trainCost !== null && regional.trainDuration) {
        options.push({
          mode: 'Train/Metro',
          duration: liveTransitDuration || regional.trainDuration,
          durationMinutes: 35,
          estimatedCost: `${regional.symbol}${regional.trainCost}`,
          notes: 'Regional estimate',
        });
      } else {
        options.push({
          mode: 'Train/Metro',
          duration: 'N/A',
          durationMinutes: 0,
          estimatedCost: 'N/A',
          notes: 'Taxi/rideshare recommended',
        });
      }
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
