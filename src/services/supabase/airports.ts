/**
 * Supabase Airports Service
 * Queries airports directly from the database
 */

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Airport = Tables<"airports">;

export interface AirportSearchResult extends Airport {
  distanceKm?: number;
  transferTimeMins?: number;
  isPrimary?: boolean;
  convenienceScore?: number;
}

/**
 * Search airports by query (code, name, or city)
 */
export async function searchAirports(
  query: string,
  limit = 10
): Promise<Airport[]> {
  const { data, error } = await supabase
    .from("airports")
    .select("*")
    .or(
      `code.ilike.%${query}%,name.ilike.%${query}%,city.ilike.%${query}%`
    )
    .limit(limit);

  if (error) {
    console.error("Error searching airports:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get airport by IATA code
 */
export async function getAirportByCode(
  code: string
): Promise<Airport | null> {
  const { data, error } = await supabase
    .from("airports")
    .select("*")
    .ilike("code", code)
    .maybeSingle();

  if (error) {
    console.error("Error fetching airport by code:", error);
    throw error;
  }

  return data;
}

/**
 * Get airports by city
 */
export async function getAirportsByCity(
  city: string,
  limit = 5
): Promise<Airport[]> {
  const { data, error } = await supabase
    .from("airports")
    .select("*")
    .ilike("city", `%${city}%`)
    .limit(limit);

  if (error) {
    console.error("Error fetching airports by city:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get airports by country
 */
export async function getAirportsByCountry(
  country: string,
  limit = 20
): Promise<Airport[]> {
  const { data, error } = await supabase
    .from("airports")
    .select("*")
    .ilike("country", country)
    .order("name")
    .limit(limit);

  if (error) {
    console.error("Error fetching airports by country:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get international airports (major hubs)
 */
export async function getInternationalAirports(
  limit = 50
): Promise<Airport[]> {
  const { data, error } = await supabase
    .from("airports")
    .select("*")
    .eq("type", "international")
    .order("name")
    .limit(limit);

  if (error) {
    console.error("Error fetching international airports:", error);
    throw error;
  }

  return data || [];
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate transfer time based on distance
 */
function estimateTransferTime(distanceKm: number): number {
  return Math.round(distanceKm * 1.5 + 15);
}

/**
 * Calculate convenience score (0-100)
 */
function calculateConvenienceScore(
  airport: Airport,
  distanceKm: number
): number {
  let score = 100;
  score -= Math.min(distanceKm * 0.5, 30);
  if (airport.type === "international") score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Search for airports near a destination with distance calculations
 */
export async function searchAirportsNearDestination(
  destinationCity: string,
  destinationLat?: number,
  destinationLon?: number,
  maxDistanceKm = 200
): Promise<AirportSearchResult[]> {
  // First try to find airports matching the city
  const { data: cityAirports, error: cityError } = await supabase
    .from("airports")
    .select("*")
    .ilike("city", `%${destinationCity}%`)
    .limit(10);

  if (cityError) {
    console.error("Error searching airports near destination:", cityError);
    throw cityError;
  }

  // If we have coordinates, calculate distances
  if (destinationLat && destinationLon && cityAirports) {
    return cityAirports
      .filter((airport) => airport.latitude && airport.longitude)
      .map((airport) => {
        const distanceKm = calculateDistance(
          destinationLat,
          destinationLon,
          airport.latitude!,
          airport.longitude!
        );
        return {
          ...airport,
          distanceKm: Math.round(distanceKm * 10) / 10,
          transferTimeMins: estimateTransferTime(distanceKm),
          convenienceScore: calculateConvenienceScore(airport, distanceKm),
        };
      })
      .filter((airport) => airport.distanceKm <= maxDistanceKm)
      .sort((a, b) => (b.convenienceScore || 0) - (a.convenienceScore || 0));
  }

  // Without coordinates, return airports with default scoring
  return (cityAirports || []).map((airport, index) => ({
    ...airport,
    isPrimary: index === 0,
    convenienceScore: airport.type === "international" ? 90 : 70,
  }));
}

/**
 * Get all airports (with pagination)
 */
export async function getAllAirports(
  limit = 100,
  offset = 0
): Promise<Airport[]> {
  const { data, error } = await supabase
    .from("airports")
    .select("*")
    .order("code")
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching all airports:", error);
    throw error;
  }

  return data || [];
}
