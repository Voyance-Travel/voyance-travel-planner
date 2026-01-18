import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeatherData {
  destination: string;
  current: {
    temp: number;
    condition: string;
    icon: string;
    humidity: number;
    windSpeed: number;
  };
  forecast: Array<{
    date: string;
    high: number;
    low: number;
    condition: string;
    icon: string;
    precipitation: number;
  }>;
}

// Seasonal weather patterns by region (fallback when no API key)
const seasonalPatterns: Record<string, Record<string, { high: number; low: number; condition: string }>> = {
  'europe': {
    'winter': { high: 8, low: 2, condition: 'Cloudy' },
    'spring': { high: 16, low: 8, condition: 'Partly Cloudy' },
    'summer': { high: 26, low: 18, condition: 'Sunny' },
    'fall': { high: 14, low: 7, condition: 'Cloudy' },
  },
  'tropical': {
    'winter': { high: 30, low: 24, condition: 'Sunny' },
    'spring': { high: 32, low: 26, condition: 'Humid' },
    'summer': { high: 33, low: 27, condition: 'Rainy' },
    'fall': { high: 31, low: 25, condition: 'Partly Cloudy' },
  },
  'mediterranean': {
    'winter': { high: 14, low: 8, condition: 'Mild' },
    'spring': { high: 20, low: 12, condition: 'Pleasant' },
    'summer': { high: 32, low: 22, condition: 'Hot & Sunny' },
    'fall': { high: 22, low: 14, condition: 'Warm' },
  },
  'default': {
    'winter': { high: 10, low: 2, condition: 'Cold' },
    'spring': { high: 18, low: 10, condition: 'Mild' },
    'summer': { high: 28, low: 18, condition: 'Warm' },
    'fall': { high: 16, low: 8, condition: 'Cool' },
  },
};

const regionMapping: Record<string, string> = {
  'paris': 'europe',
  'london': 'europe',
  'berlin': 'europe',
  'amsterdam': 'europe',
  'rome': 'mediterranean',
  'barcelona': 'mediterranean',
  'lisbon': 'mediterranean',
  'athens': 'mediterranean',
  'dubai': 'tropical',
  'singapore': 'tropical',
  'bangkok': 'tropical',
  'bali': 'tropical',
  'tokyo': 'default',
  'new york': 'default',
  'los angeles': 'mediterranean',
  'miami': 'tropical',
};

function getSeason(date: Date): string {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function getRegion(destination: string): string {
  const normalized = destination.toLowerCase();
  for (const [city, region] of Object.entries(regionMapping)) {
    if (normalized.includes(city)) return region;
  }
  return 'default';
}

function generateForecast(destination: string, startDate: string, days: number = 7): WeatherData {
  const region = getRegion(destination);
  const patterns = seasonalPatterns[region] || seasonalPatterns['default'];
  
  const start = new Date(startDate);
  const season = getSeason(start);
  const base = patterns[season];
  
  const forecast = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    
    // Add some variation
    const variance = Math.random() * 4 - 2;
    
    forecast.push({
      date: date.toISOString().split('T')[0],
      high: Math.round(base.high + variance),
      low: Math.round(base.low + variance),
      condition: base.condition,
      icon: base.condition.toLowerCase().includes('sunny') ? '☀️' : 
            base.condition.toLowerCase().includes('rain') ? '🌧️' : 
            base.condition.toLowerCase().includes('cloud') ? '☁️' : '⛅',
      precipitation: base.condition.toLowerCase().includes('rain') ? 60 : 10,
    });
  }
  
  return {
    destination,
    current: {
      temp: Math.round(base.high - 3),
      condition: base.condition,
      icon: forecast[0].icon,
      humidity: 55,
      windSpeed: 12,
    },
    forecast,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { destination, startDate, days } = body;
    
    if (!destination) {
      return new Response(
        JSON.stringify({ error: 'Destination is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate weather data (could integrate with real API if key is available)
    const weather = generateForecast(
      destination, 
      startDate || new Date().toISOString().split('T')[0],
      days || 7
    );

    console.log('[Weather] Generated forecast for:', destination);

    return new Response(JSON.stringify({ weather, success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[Weather] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
