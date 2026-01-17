/**
 * Voyance Weather API Service
 * 
 * Integrates with Railway backend weather endpoints:
 * - GET /api/weather/:destinationId - Get weather data for a destination
 */

import { useQuery } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

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
  forecast?: WeatherForecast[];
}

export interface WeatherResponse {
  destinationId: string;
  weather: WeatherData;
}

// ============================================================================
// API Helpers
// ============================================================================

async function weatherApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BACKEND_URL}/api/weather${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData._error || errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Weather API
// ============================================================================

/**
 * Get weather data for a destination
 */
export async function getWeather(destinationId: string): Promise<WeatherResponse> {
  return weatherApiRequest<WeatherResponse>(`/${destinationId}`);
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
