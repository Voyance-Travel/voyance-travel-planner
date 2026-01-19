import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// Types
// ============================================================================

interface WeatherData {
  destination: string;
  current: {
    temp: number;
    feelsLike: number;
    condition: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    precipitation: number;
  };
  forecast: Array<{
    date: string;
    high: number;
    low: number;
    condition: string;
    icon: string;
    precipitation: number;
  }>;
  source: 'open-meteo' | 'fallback';
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    precipitation: number;
    weather_code: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_sum: number[];
  };
}

interface GeocodingResult {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country: string;
  }>;
}

// ============================================================================
// Weather Code Mapping (WMO codes)
// ============================================================================

function getConditionFromCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Fog';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 56 && code <= 57) return 'Freezing drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 66 && code <= 67) return 'Freezing rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function getWeatherIcon(code: number): string {
  if (code === 0 || code === 1) return '☀️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95 && code <= 99) return '⛈️';
  return '⛅';
}

// ============================================================================
// Seasonal Fallback (when geocoding fails)
// ============================================================================

const seasonalPatterns: Record<string, Record<string, { high: number; low: number; condition: string; code: number }>> = {
  'europe': {
    'winter': { high: 8, low: 2, condition: 'Cloudy', code: 3 },
    'spring': { high: 16, low: 8, condition: 'Partly cloudy', code: 2 },
    'summer': { high: 26, low: 18, condition: 'Sunny', code: 0 },
    'fall': { high: 14, low: 7, condition: 'Cloudy', code: 3 },
  },
  'tropical': {
    'winter': { high: 30, low: 24, condition: 'Sunny', code: 0 },
    'spring': { high: 32, low: 26, condition: 'Humid', code: 2 },
    'summer': { high: 33, low: 27, condition: 'Rainy', code: 61 },
    'fall': { high: 31, low: 25, condition: 'Partly cloudy', code: 2 },
  },
  'mediterranean': {
    'winter': { high: 14, low: 8, condition: 'Mild', code: 2 },
    'spring': { high: 20, low: 12, condition: 'Pleasant', code: 1 },
    'summer': { high: 32, low: 22, condition: 'Hot & Sunny', code: 0 },
    'fall': { high: 22, low: 14, condition: 'Warm', code: 1 },
  },
  'default': {
    'winter': { high: 10, low: 2, condition: 'Cold', code: 3 },
    'spring': { high: 18, low: 10, condition: 'Mild', code: 2 },
    'summer': { high: 28, low: 18, condition: 'Warm', code: 1 },
    'fall': { high: 16, low: 8, condition: 'Cool', code: 2 },
  },
};

const regionMapping: Record<string, string> = {
  'paris': 'europe', 'london': 'europe', 'berlin': 'europe', 'amsterdam': 'europe',
  'rome': 'mediterranean', 'barcelona': 'mediterranean', 'lisbon': 'mediterranean', 'athens': 'mediterranean',
  'dubai': 'tropical', 'singapore': 'tropical', 'bangkok': 'tropical', 'bali': 'tropical',
  'tokyo': 'default', 'new york': 'default', 'los angeles': 'mediterranean', 'miami': 'tropical',
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

function generateFallbackForecast(destination: string, startDate: string, days: number = 7): WeatherData {
  const region = getRegion(destination);
  const patterns = seasonalPatterns[region] || seasonalPatterns['default'];
  const start = new Date(startDate);
  const season = getSeason(start);
  const base = patterns[season];

  const forecast = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const variance = Math.random() * 4 - 2;

    forecast.push({
      date: date.toISOString().split('T')[0],
      high: Math.round(base.high + variance),
      low: Math.round(base.low + variance),
      condition: base.condition,
      icon: getWeatherIcon(base.code),
      precipitation: base.code >= 51 && base.code <= 82 ? 60 : 10,
    });
  }

  return {
    destination,
    current: {
      temp: Math.round(base.high - 3),
      feelsLike: Math.round(base.high - 4),
      condition: base.condition,
      icon: getWeatherIcon(base.code),
      humidity: 55,
      windSpeed: 12,
      precipitation: forecast[0].precipitation,
    },
    forecast,
    source: 'fallback',
  };
}

// ============================================================================
// Open-Meteo API (Free, no API key required)
// ============================================================================

async function geocodeDestination(destination: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`;
    console.log('[Weather] Geocoding destination:', destination);

    const response = await fetch(url);
    if (!response.ok) {
      console.error('[Weather] Geocoding HTTP error:', response.status);
      return null;
    }

    const data: GeocodingResult = await response.json();
    if (!data.results || data.results.length === 0) {
      console.warn('[Weather] No geocoding results for:', destination);
      return null;
    }

    const result = data.results[0];
    console.log('[Weather] Geocoded to:', result.name, result.latitude, result.longitude);
    return { lat: result.latitude, lon: result.longitude, name: result.name };
  } catch (error) {
    console.error('[Weather] Geocoding error:', error);
    return null;
  }
}

async function fetchOpenMeteo(destination: string, days: number = 7): Promise<WeatherData | null> {
  const geo = await geocodeDestination(destination);
  if (!geo) return null;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&timezone=auto&forecast_days=${Math.min(days, 16)}`;

    console.log('[Weather] Fetching Open-Meteo for:', geo.name);

    const response = await fetch(url);
    if (!response.ok) {
      console.error('[Weather] Open-Meteo HTTP error:', response.status);
      return null;
    }

    const data: OpenMeteoResponse = await response.json();

    if (!data.current || !data.daily) {
      console.error('[Weather] Open-Meteo missing data');
      return null;
    }

    const current = data.current;
    const daily = data.daily;

    const forecast = daily.time.map((date, i) => ({
      date,
      high: Math.round(daily.temperature_2m_max[i]),
      low: Math.round(daily.temperature_2m_min[i]),
      condition: getConditionFromCode(daily.weather_code[i]),
      icon: getWeatherIcon(daily.weather_code[i]),
      precipitation: Math.round(daily.precipitation_sum[i] || 0),
    }));

    return {
      destination: geo.name,
      current: {
        temp: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        condition: getConditionFromCode(current.weather_code),
        icon: getWeatherIcon(current.weather_code),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        precipitation: Math.round(current.precipitation || 0),
      },
      forecast,
      source: 'open-meteo',
    };
  } catch (error) {
    console.error('[Weather] Open-Meteo fetch error:', error);
    return null;
  }
}

// ============================================================================
// Main Handler
// ============================================================================

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

    let weather: WeatherData;

    // Try Open-Meteo (free, no API key)
    const realWeather = await fetchOpenMeteo(destination, days || 7);
    if (realWeather) {
      weather = realWeather;
      console.log('[Weather] ✅ Using Open-Meteo data for:', destination);
    } else {
      weather = generateFallbackForecast(
        destination,
        startDate || new Date().toISOString().split('T')[0],
        days || 7
      );
      console.log('[Weather] ⚠️ Open-Meteo failed, using fallback for:', destination);
    }

    return new Response(JSON.stringify({ weather, success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[Weather] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
