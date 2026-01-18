/**
 * Location Search API - Connects to Neon DB for airports and destinations
 * Supports metro area groupings for major cities
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

export interface MetroArea {
  id: string;
  name: string;
  airports: Airport[];
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

// Metro area definitions for common multi-airport cities
const METRO_AREAS: Record<string, { name: string; codes: string[] }> = {
  // United States
  'nyc': { name: 'New York City', codes: ['JFK', 'EWR', 'LGA'] },
  'new york': { name: 'New York City', codes: ['JFK', 'EWR', 'LGA'] },
  'chicago': { name: 'Chicago', codes: ['ORD', 'MDW'] },
  'los angeles': { name: 'Los Angeles', codes: ['LAX', 'BUR', 'LGB', 'SNA'] },
  'la': { name: 'Los Angeles', codes: ['LAX', 'BUR', 'LGB', 'SNA'] },
  'san francisco': { name: 'San Francisco Bay Area', codes: ['SFO', 'OAK', 'SJC'] },
  'sf': { name: 'San Francisco Bay Area', codes: ['SFO', 'OAK', 'SJC'] },
  'washington': { name: 'Washington D.C.', codes: ['DCA', 'IAD', 'BWI'] },
  'dc': { name: 'Washington D.C.', codes: ['DCA', 'IAD', 'BWI'] },
  'miami': { name: 'Miami', codes: ['MIA', 'FLL', 'PBI'] },
  'dallas': { name: 'Dallas/Fort Worth', codes: ['DFW', 'DAL'] },
  'houston': { name: 'Houston', codes: ['IAH', 'HOU'] },
  
  // Europe
  'london': { name: 'London', codes: ['LHR', 'LGW', 'STN', 'LTN', 'LCY'] },
  'paris': { name: 'Paris', codes: ['CDG', 'ORY'] },
  'milan': { name: 'Milan', codes: ['MXP', 'LIN', 'BGY'] },
  'rome': { name: 'Rome', codes: ['FCO', 'CIA'] },
  'berlin': { name: 'Berlin', codes: ['BER', 'SXF'] },
  'moscow': { name: 'Moscow', codes: ['SVO', 'DME', 'VKO'] },
  'stockholm': { name: 'Stockholm', codes: ['ARN', 'BMA', 'NYO'] },
  
  // Asia
  'tokyo': { name: 'Tokyo', codes: ['NRT', 'HND'] },
  'osaka': { name: 'Osaka', codes: ['KIX', 'ITM'] },
  'shanghai': { name: 'Shanghai', codes: ['PVG', 'SHA'] },
  'beijing': { name: 'Beijing', codes: ['PEK', 'PKX'] },
  'seoul': { name: 'Seoul', codes: ['ICN', 'GMP'] },
  'bangkok': { name: 'Bangkok', codes: ['BKK', 'DMK'] },
  
  // Other
  'sao paulo': { name: 'São Paulo', codes: ['GRU', 'CGH', 'VCP'] },
  'buenos aires': { name: 'Buenos Aires', codes: ['EZE', 'AEP'] },
  'melbourne': { name: 'Melbourne', codes: ['MEL', 'AVV'] },
  'sydney': { name: 'Sydney', codes: ['SYD'] },
  'toronto': { name: 'Toronto', codes: ['YYZ', 'YTZ'] },
};

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
 * Check if query matches a metro area and return grouped results
 */
function findMetroArea(query: string): { name: string; codes: string[] } | null {
  const normalizedQuery = query.toLowerCase().trim();
  
  for (const [key, metro] of Object.entries(METRO_AREAS)) {
    if (normalizedQuery === key || normalizedQuery.includes(key)) {
      return metro;
    }
  }
  
  return null;
}

/**
 * Search airports by code, city, or name with metro area grouping
 */
export async function searchAirports(query: string, limit = 20): Promise<Airport[]> {
  // First, check if query matches a metro area
  const metroArea = findMetroArea(query);
  
  if (metroArea) {
    // Search for all airports in this metro area
    const results: Airport[] = [];
    
    for (const code of metroArea.codes) {
      const result = await fetchFromNeon<Airport>('/airports', { q: code, limit: '5' });
      if (result.data) {
        results.push(...result.data.filter(a => a.code === code));
      }
    }
    
    // Dedupe by code
    const seen = new Set<string>();
    return results.filter(a => {
      if (seen.has(a.code)) return false;
      seen.add(a.code);
      return true;
    });
  }
  
  // Otherwise, regular search
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

/**
 * Get metro area info if query matches
 */
export function getMetroAreaInfo(query: string): { name: string; codes: string[] } | null {
  return findMetroArea(query);
}

// Format helpers
export function formatAirportDisplay(airport: Airport): string {
  return `${airport.city} (${airport.code})`;
}

export function formatDestinationDisplay(destination: Destination): string {
  return `${destination.city}, ${destination.country}`;
}
