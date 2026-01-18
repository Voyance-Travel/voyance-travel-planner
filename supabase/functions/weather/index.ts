import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeatherStackCurrent {
  temperature: number;
  weather_descriptions: string[];
  weather_icons: string[];
  humidity: number;
  wind_speed: number;
  precip: number;
  feelslike: number;
}

interface WeatherStackResponse {
  success?: boolean;
  error?: { info: string };
  current: WeatherStackCurrent;
  location: {
    name: string;
    country: string;
    localtime: string;
  };
}

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
  source: 'weatherstack' | 'fallback';
}

// Seasonal weather patterns by region (fallback when API fails)
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

function getWeatherIcon(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('sunny') || c.includes('clear')) return '☀️';
  if (c.includes('rain') || c.includes('shower')) return '🌧️';
  if (c.includes('cloud') || c.includes('overcast')) return '☁️';
  if (c.includes('snow')) return '❄️';
  if (c.includes('thunder') || c.includes('storm')) return '⛈️';
  if (c.includes('fog') || c.includes('mist')) return '🌫️';
  return '⛅';
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
      icon: getWeatherIcon(base.condition),
      precipitation: base.condition.toLowerCase().includes('rain') ? 60 : 10,
    });
  }
  
  return {
    destination,
    current: {
      temp: Math.round(base.high - 3),
      feelsLike: Math.round(base.high - 4),
      condition: base.condition,
      icon: forecast[0].icon,
      humidity: 55,
      windSpeed: 12,
      precipitation: forecast[0].precipitation,
    },
    forecast,
    source: 'fallback',
  };
}

async function fetchWeatherStack(destination: string, apiKey: string): Promise<WeatherData | null> {
  try {
    const url = `http://api.weatherstack.com/current?access_key=${apiKey}&query=${encodeURIComponent(destination)}&units=m`;
    
    console.log('[Weather] Fetching from Weatherstack for:', destination);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[Weather] Weatherstack HTTP error:', response.status);
      return null;
    }
    
    const data: WeatherStackResponse = await response.json();
    
    if (data.error) {
      console.error('[Weather] Weatherstack API error:', data.error.info);
      return null;
    }
    
    const current = data.current;
    const condition = current.weather_descriptions?.[0] || 'Unknown';
    
    // Generate forecast based on current conditions (Weatherstack free tier only has current)
    const baseTemp = current.temperature;
    const forecast = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const variance = Math.random() * 6 - 3;
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        high: Math.round(baseTemp + 3 + variance),
        low: Math.round(baseTemp - 5 + variance),
        condition: i === 0 ? condition : 'Similar conditions',
        icon: getWeatherIcon(condition),
        precipitation: current.precip || 0,
      });
    }
    
    return {
      destination: data.location?.name || destination,
      current: {
        temp: current.temperature,
        feelsLike: current.feelslike,
        condition,
        icon: getWeatherIcon(condition),
        humidity: current.humidity,
        windSpeed: current.wind_speed,
        precipitation: current.precip || 0,
      },
      forecast,
      source: 'weatherstack',
    };
  } catch (error) {
    console.error('[Weather] Weatherstack fetch error:', error);
    return null;
  }
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

    const apiKey = Deno.env.get('WEATHERSTACK_API_KEY');
    let weather: WeatherData;
    
    if (apiKey) {
      const realWeather = await fetchWeatherStack(destination, apiKey);
      if (realWeather) {
        weather = realWeather;
        console.log('[Weather] Using Weatherstack data for:', destination);
      } else {
        weather = generateFallbackForecast(
          destination, 
          startDate || new Date().toISOString().split('T')[0],
          days || 7
        );
        console.log('[Weather] Weatherstack failed, using fallback for:', destination);
      }
    } else {
      weather = generateFallbackForecast(
        destination, 
        startDate || new Date().toISOString().split('T')[0],
        days || 7
      );
      console.log('[Weather] No API key, using fallback for:', destination);
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
