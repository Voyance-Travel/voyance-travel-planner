/**
 * Location Search API - Connects to Neon DB for airports and destinations
 */

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/neon-db`;

export interface Airport {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  type?: string;
}

export interface Destination {
  id: string;
  city: string;
  country: string;
  region?: string;
  description?: string;
  airport_codes?: string[];
  featured?: boolean;
  cost_tier?: string;
  best_time_to_visit?: string;
}

interface ApiResponse<T> {
  data: T[] | null;
  error: string | null;
}

async function fetchFromNeon<T>(path: string, params: Record<string, string> = {}): Promise<ApiResponse<T>> {
  const queryString = new URLSearchParams(params).toString();
  const url = `${FUNCTION_URL}${path}${queryString ? `?${queryString}` : ''}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[locationSearchAPI] Error:', error);
    return { data: null, error: (error as Error).message };
  }
}

/**
 * Search airports by code, city, or name
 */
export async function searchAirports(query: string, limit = 20): Promise<Airport[]> {
  const result = await fetchFromNeon<Airport>('/airports', { q: query, limit: String(limit) });
  return result.data || [];
}

/**
 * Search destinations by city, country, or region
 */
export async function searchDestinations(query: string, limit = 20): Promise<Destination[]> {
  const result = await fetchFromNeon<Destination>('/destinations', { q: query, limit: String(limit) });
  return result.data || [];
}

/**
 * Get featured destinations
 */
export async function getFeaturedDestinations(limit = 10): Promise<Destination[]> {
  const result = await fetchFromNeon<Destination>('/destinations', { featured: 'true', limit: String(limit) });
  return result.data || [];
}

/**
 * Get major hub airports (for initial display)
 */
export async function getMajorAirports(limit = 30): Promise<Airport[]> {
  const result = await fetchFromNeon<Airport>('/airports', { limit: String(limit) });
  return result.data || [];
}

// Format helpers
export function formatAirportDisplay(airport: Airport): string {
  return `${airport.city} (${airport.code})`;
}

export function formatDestinationDisplay(destination: Destination): string {
  return `${destination.city}, ${destination.country}`;
}
