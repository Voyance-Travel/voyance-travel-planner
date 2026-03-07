/**
 * Voyance Weather API Service
 * 
 * Uses Cloud edge function for weather data
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getLocalToday } from '@/utils/dateUtils';

// ============================================================================
// Types
// ============================================================================

export interface WeatherForecast {
  date: string;
  condition: string;
  high: number;
  low: number;
}

export interface WeatherData {
  temperatureRange: string | null;
  seasonality: string | null;
  bestTimeToVisit: string | null;
  lastUpdated: string | null;
  isDynamic: boolean;
  precipitation?: string;
  humidity?: string;
  windSpeed?: string;
  uvIndex?: string;
  airQuality?: string;
  currentConditions?: string;
  feelsLike?: number;
  forecast?: WeatherForecast[];
  source?: 'weatherkit' | 'open-meteo' | 'fallback';
}

export interface WeatherResponse {
  destinationId: string;
  weather: WeatherData;
}

// ============================================================================
// Weather API
// ============================================================================

/**
 * Get weather data for a destination using Cloud edge function
 */
export async function getWeather(destinationId: string): Promise<WeatherResponse> {
  const { data, error } = await supabase.functions.invoke('weather', {
    body: {
      destination: destinationId,
      startDate: getLocalToday(),
      days: 7,
    },
  });

  if (error) {
    console.warn('[WeatherAPI] Cloud function error:', error);
    throw new Error('Failed to fetch weather data');
  }

  // Transform the response to match existing interface
  const weatherData = data?.weather;
  const isRealData = weatherData?.source === 'weatherkit' || weatherData?.source === 'open-meteo';
  
  return {
    destinationId,
    weather: {
      temperatureRange: weatherData?.current 
        ? `${weatherData.current.temp - 5}°C - ${weatherData.current.temp + 5}°C`
        : null,
      seasonality: null,
      bestTimeToVisit: null,
      lastUpdated: new Date().toISOString(),
      isDynamic: isRealData,
      precipitation: weatherData?.current?.precipitation ? `${weatherData.current.precipitation}mm` : undefined,
      humidity: weatherData?.current?.humidity ? `${weatherData.current.humidity}%` : undefined,
      windSpeed: weatherData?.current?.windSpeed ? `${weatherData.current.windSpeed} km/h` : undefined,
      currentConditions: weatherData?.current?.condition,
      feelsLike: weatherData?.current?.feelsLike,
      forecast: weatherData?.forecast?.map((f: any) => ({
        date: f.date,
        condition: f.condition,
        high: f.high,
        low: f.low,
      })),
      source: weatherData?.source || 'fallback',
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get weather condition icon (for lucide-react)
 */
export function getWeatherIcon(condition: string): string {
  const lower = condition.toLowerCase();
  
  if (lower.includes('sun') || lower.includes('clear')) return 'Sun';
  if (lower.includes('cloud') && lower.includes('sun')) return 'CloudSun';
  if (lower.includes('cloud')) return 'Cloud';
  if (lower.includes('rain') || lower.includes('shower')) return 'CloudRain';
  if (lower.includes('storm') || lower.includes('thunder')) return 'CloudLightning';
  if (lower.includes('snow')) return 'CloudSnow';
  if (lower.includes('fog') || lower.includes('mist')) return 'CloudFog';
  if (lower.includes('wind')) return 'Wind';
  
  return 'Cloud';
}

/**
 * Format temperature for display
 */
export function formatTemperature(temp: number, unit: 'C' | 'F' = 'F'): string {
  if (unit === 'C') {
    return `${Math.round(temp)}°C`;
  }
  return `${Math.round(temp)}°F`;
}

/**
 * Get season recommendation color
 */
export function getSeasonColor(seasonality: string | null): string {
  if (!seasonality) return 'gray';
  
  const lower = seasonality.toLowerCase();
  if (lower.includes('best') || lower.includes('peak')) return 'green';
  if (lower.includes('good') || lower.includes('shoulder')) return 'yellow';
  if (lower.includes('off') || lower.includes('monsoon')) return 'orange';
  
  return 'blue';
}

/**
 * Parse temperature range string to min/max values
 */
export function parseTemperatureRange(range: string | null): { min: number; max: number } | null {
  if (!range) return null;
  
  // Match patterns like "15-25°C" or "60-80°F"
  const match = range.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (match) {
    return {
      min: parseInt(match[1], 10),
      max: parseInt(match[2], 10),
    };
  }
  
  return null;
}

// ============================================================================
// React Query Hooks
// ============================================================================

const weatherKeys = {
  all: ['weather'] as const,
  destination: (destinationId: string) => [...weatherKeys.all, 'destination', destinationId] as const,
};

export function useWeather(destinationId: string | null) {
  return useQuery({
    queryKey: weatherKeys.destination(destinationId || ''),
    queryFn: () => destinationId ? getWeather(destinationId) : Promise.reject('No destination ID'),
    enabled: !!destinationId,
    staleTime: 30 * 60_000, // 30 minutes
  });
}

// Default export
export default {
  getWeather,
  getWeatherIcon,
  formatTemperature,
  getSeasonColor,
  parseTemperatureRange,
};
