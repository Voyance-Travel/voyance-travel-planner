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
