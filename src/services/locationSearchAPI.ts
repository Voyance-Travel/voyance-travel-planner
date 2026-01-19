/**
 * Location Search API - Uses Supabase for airports and destinations
 * Supports metro area groupings for major cities
 */

import { supabase } from '@/integrations/supabase/client';

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

// Metro area definitions for common multi-airport cities
// Keys include both city names and common airport code prefixes
const METRO_AREAS: Record<string, { name: string; codes: string[] }> = {
  // United States
  'nyc': { name: 'New York City', codes: ['JFK', 'EWR', 'LGA'] },
  'new york': { name: 'New York City', codes: ['JFK', 'EWR', 'LGA'] },
  'chicago': { name: 'Chicago', codes: ['ORD', 'MDW'] },
  'chi': { name: 'Chicago', codes: ['ORD', 'MDW'] },
  'los angeles': { name: 'Los Angeles', codes: ['LAX', 'BUR', 'LGB', 'SNA'] },
  'la': { name: 'Los Angeles', codes: ['LAX', 'BUR', 'LGB', 'SNA'] },
  'lax': { name: 'Los Angeles', codes: ['LAX', 'BUR', 'LGB', 'SNA'] },
  'san francisco': { name: 'San Francisco Bay Area', codes: ['SFO', 'OAK', 'SJC'] },
  'sf': { name: 'San Francisco Bay Area', codes: ['SFO', 'OAK', 'SJC'] },
  'sfo': { name: 'San Francisco Bay Area', codes: ['SFO', 'OAK', 'SJC'] },
  'washington': { name: 'Washington D.C.', codes: ['DCA', 'IAD', 'BWI'] },
  'dc': { name: 'Washington D.C.', codes: ['DCA', 'IAD', 'BWI'] },
  'was': { name: 'Washington D.C.', codes: ['DCA', 'IAD', 'BWI'] },
  'miami': { name: 'Miami', codes: ['MIA', 'FLL', 'PBI'] },
  'mia': { name: 'Miami', codes: ['MIA', 'FLL', 'PBI'] },
  'dallas': { name: 'Dallas/Fort Worth', codes: ['DFW', 'DAL'] },
  'dfw': { name: 'Dallas/Fort Worth', codes: ['DFW', 'DAL'] },
  'houston': { name: 'Houston', codes: ['IAH', 'HOU'] },
  'hou': { name: 'Houston', codes: ['IAH', 'HOU'] },
  'atlanta': { name: 'Atlanta', codes: ['ATL'] },
  'atl': { name: 'Atlanta', codes: ['ATL'] },
  
  // Europe
  'london': { name: 'London', codes: ['LHR', 'LGW', 'STN', 'LTN', 'LCY'] },
  'lon': { name: 'London', codes: ['LHR', 'LGW', 'STN', 'LTN', 'LCY'] },
  'paris': { name: 'Paris', codes: ['CDG', 'ORY'] },
  'par': { name: 'Paris', codes: ['CDG', 'ORY'] },
  'milan': { name: 'Milan', codes: ['MXP', 'LIN', 'BGY'] },
  'mil': { name: 'Milan', codes: ['MXP', 'LIN', 'BGY'] },
  'rome': { name: 'Rome', codes: ['FCO', 'CIA'] },
  'rom': { name: 'Rome', codes: ['FCO', 'CIA'] },
  'berlin': { name: 'Berlin', codes: ['BER', 'SXF'] },
  'ber': { name: 'Berlin', codes: ['BER', 'SXF'] },
  'moscow': { name: 'Moscow', codes: ['SVO', 'DME', 'VKO'] },
  'mow': { name: 'Moscow', codes: ['SVO', 'DME', 'VKO'] },
  'stockholm': { name: 'Stockholm', codes: ['ARN', 'BMA', 'NYO'] },
  'sto': { name: 'Stockholm', codes: ['ARN', 'BMA', 'NYO'] },
  'amsterdam': { name: 'Amsterdam', codes: ['AMS'] },
  'ams': { name: 'Amsterdam', codes: ['AMS'] },
  
  // Asia
  'tokyo': { name: 'Tokyo', codes: ['NRT', 'HND'] },
  'tyo': { name: 'Tokyo', codes: ['NRT', 'HND'] },
  'osaka': { name: 'Osaka', codes: ['KIX', 'ITM'] },
  'osa': { name: 'Osaka', codes: ['KIX', 'ITM'] },
  'shanghai': { name: 'Shanghai', codes: ['PVG', 'SHA'] },
  'sha': { name: 'Shanghai', codes: ['PVG', 'SHA'] },
  'beijing': { name: 'Beijing', codes: ['PEK', 'PKX'] },
  'bjs': { name: 'Beijing', codes: ['PEK', 'PKX'] },
  'seoul': { name: 'Seoul', codes: ['ICN', 'GMP'] },
  'sel': { name: 'Seoul', codes: ['ICN', 'GMP'] },
  'bangkok': { name: 'Bangkok', codes: ['BKK', 'DMK'] },
  'bkk': { name: 'Bangkok', codes: ['BKK', 'DMK'] },
  'singapore': { name: 'Singapore', codes: ['SIN'] },
  'sin': { name: 'Singapore', codes: ['SIN'] },
  'hong kong': { name: 'Hong Kong', codes: ['HKG'] },
  'hkg': { name: 'Hong Kong', codes: ['HKG'] },
  
  // Other
  'sao paulo': { name: 'São Paulo', codes: ['GRU', 'CGH', 'VCP'] },
  'sao': { name: 'São Paulo', codes: ['GRU', 'CGH', 'VCP'] },
  'buenos aires': { name: 'Buenos Aires', codes: ['EZE', 'AEP'] },
  'bue': { name: 'Buenos Aires', codes: ['EZE', 'AEP'] },
  'melbourne': { name: 'Melbourne', codes: ['MEL', 'AVV'] },
  'mel': { name: 'Melbourne', codes: ['MEL', 'AVV'] },
  'sydney': { name: 'Sydney', codes: ['SYD'] },
  'syd': { name: 'Sydney', codes: ['SYD'] },
  'toronto': { name: 'Toronto', codes: ['YYZ', 'YTZ'] },
  'yto': { name: 'Toronto', codes: ['YYZ', 'YTZ'] },
  'dubai': { name: 'Dubai', codes: ['DXB', 'DWC'] },
  'dxb': { name: 'Dubai', codes: ['DXB', 'DWC'] },
};

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
    // Search for all airports in this metro area by codes
    const { data, error } = await supabase
      .from('airports')
      .select('*')
      .in('code', metroArea.codes);
    
    if (error) {
      console.error('[locationSearchAPI] Error:', error);
      return [];
    }
    
    return (data || []).map(a => ({
      id: a.id,
      code: a.code,
      name: a.name,
      city: a.city || '',
      country: a.country || '',
      latitude: a.latitude ? Number(a.latitude) : undefined,
      longitude: a.longitude ? Number(a.longitude) : undefined,
      type: a.type || undefined,
    }));
  }
  
  // Otherwise, regular search
  const { data, error } = await supabase
    .from('airports')
    .select('*')
    .or(`code.ilike.%${query}%,name.ilike.%${query}%,city.ilike.%${query}%`)
    .limit(limit);

  if (error) {
    console.error('[locationSearchAPI] Error:', error);
    return [];
  }

  return (data || []).map(a => ({
    id: a.id,
    code: a.code,
    name: a.name,
    city: a.city || '',
    country: a.country || '',
    latitude: a.latitude ? Number(a.latitude) : undefined,
    longitude: a.longitude ? Number(a.longitude) : undefined,
    type: a.type || undefined,
  }));
}

/**
 * Search destinations by city, country, or region
 */
export async function searchDestinations(query: string, limit = 20): Promise<Destination[]> {
  const { data, error } = await supabase
    .from('destinations')
    .select('*')
    .or(`city.ilike.%${query}%,country.ilike.%${query}%,region.ilike.%${query}%`)
    .limit(limit);

  if (error) {
    console.error('[locationSearchAPI] Error:', error);
    return [];
  }

  return (data || []).map(d => ({
    id: d.id,
    city: d.city,
    country: d.country,
    region: d.region || undefined,
    description: d.description || undefined,
    airport_codes: d.airport_codes ? (d.airport_codes as string[]) : undefined,
    featured: d.featured || undefined,
    cost_tier: d.cost_tier || undefined,
    best_time_to_visit: d.best_time_to_visit || undefined,
  }));
}

/**
 * Get featured destinations
 */
export async function getFeaturedDestinations(limit = 10): Promise<Destination[]> {
  const { data, error } = await supabase
    .from('destinations')
    .select('*')
    .eq('featured', true)
    .limit(limit);

  if (error) {
    console.error('[locationSearchAPI] Error:', error);
    return [];
  }

  return (data || []).map(d => ({
    id: d.id,
    city: d.city,
    country: d.country,
    region: d.region || undefined,
    description: d.description || undefined,
    featured: d.featured || undefined,
  }));
}

/**
 * Get major hub airports (for initial display)
 */
export async function getMajorAirports(limit = 30): Promise<Airport[]> {
  const { data, error } = await supabase
    .from('airports')
    .select('*')
    .eq('type', 'international')
    .limit(limit);

  if (error) {
    console.error('[locationSearchAPI] Error:', error);
    return [];
  }

  return (data || []).map(a => ({
    id: a.id,
    code: a.code,
    name: a.name,
    city: a.city || '',
    country: a.country || '',
    latitude: a.latitude ? Number(a.latitude) : undefined,
    longitude: a.longitude ? Number(a.longitude) : undefined,
    type: a.type || undefined,
  }));
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
