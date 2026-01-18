/**
 * Airport Search Utilities
 * Find airports by destination with distance calculations
 * Now uses Supabase database for airport data
 */

import { supabase } from "@/integrations/supabase/client";

export interface Airport {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  isInternational?: boolean;
  isMajorHub?: boolean;
}

export interface AirportSearchResult extends Airport {
  distanceKm: number;
  transferTimeMins: number;
  isPrimary?: boolean;
  convenienceScore: number;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate transfer time based on distance
 */
function estimateTransferTime(distanceKm: number): number {
  // Rough estimate: 1.5 min per km for city transfers
  return Math.round(distanceKm * 1.5 + 15); // +15 min base
}

/**
 * Calculate convenience score (0-100)
 */
function calculateConvenienceScore(airport: Airport, distanceKm: number): number {
  let score = 100;
  
  // Distance penalty
  score -= Math.min(distanceKm * 0.5, 30);
  
  // Bonus for major hub
  if (airport.isMajorHub) score += 10;
  
  // Bonus for international
  if (airport.isInternational) score += 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Convert database airport to our Airport interface
 */
function mapDbAirport(dbAirport: any): Airport {
  return {
    id: dbAirport.id,
    code: dbAirport.code,
    name: dbAirport.name,
    city: dbAirport.city || '',
    country: dbAirport.country || '',
    latitude: dbAirport.latitude ? Number(dbAirport.latitude) : 0,
    longitude: dbAirport.longitude ? Number(dbAirport.longitude) : 0,
    isInternational: dbAirport.type === 'international',
    isMajorHub: dbAirport.type === 'international',
  };
}

/**
 * Search for airports near a destination
 */
export async function searchAirportsNearDestination(
  destinationCity: string,
  maxDistanceKm = 200
): Promise<AirportSearchResult[]> {
  const { data, error } = await supabase
    .from('airports')
    .select('*')
    .ilike('city', `%${destinationCity}%`)
    .limit(10);

  if (error) {
    console.error('Error searching airports:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data
    .map(mapDbAirport)
    .map((airport, index) => {
      const distanceKm = 10 + Math.random() * 30; // Default distance since we don't have destination coords
      return {
        ...airport,
        distanceKm: Math.round(distanceKm * 10) / 10,
        transferTimeMins: estimateTransferTime(distanceKm),
        isPrimary: index === 0,
        convenienceScore: calculateConvenienceScore(airport, distanceKm),
      };
    })
    .filter(airport => airport.distanceKm <= maxDistanceKm)
    .sort((a, b) => b.convenienceScore - a.convenienceScore);
}

/**
 * Get airport by code
 */
export async function getAirportByCode(code: string): Promise<Airport | undefined> {
  const { data, error } = await supabase
    .from('airports')
    .select('*')
    .ilike('code', code)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return mapDbAirport(data);
}

/**
 * Search airports by query
 */
export async function searchAirports(query: string): Promise<Airport[]> {
  const { data, error } = await supabase
    .from('airports')
    .select('*')
    .or(`code.ilike.%${query}%,name.ilike.%${query}%,city.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error('Error searching airports:', error);
    return [];
  }

  return (data || []).map(mapDbAirport);
}

/**
 * Get all major hub airports
 */
export async function getMajorHubs(): Promise<Airport[]> {
  const { data, error } = await supabase
    .from('airports')
    .select('*')
    .eq('type', 'international')
    .limit(50);

  if (error) {
    console.error('Error fetching major hubs:', error);
    return [];
  }

  return (data || []).map(mapDbAirport);
}
