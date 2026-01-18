/**
 * Supabase Attractions Service
 * Queries attractions directly from the database
 */

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Attraction = Tables<"attractions">;

export interface AttractionSearchParams {
  destinationId?: string;
  category?: string;
  subcategory?: string;
  search?: string;
  minRating?: number;
  limit?: number;
  offset?: number;
}

/**
 * Search attractions with filters
 */
export async function searchAttractions(
  params: AttractionSearchParams = {}
): Promise<Attraction[]> {
  let query = supabase.from("attractions").select("*");

  if (params.destinationId) {
    query = query.eq("destination_id", params.destinationId);
  }
  if (params.category) {
    query = query.ilike("category", params.category);
  }
  if (params.subcategory) {
    query = query.ilike("subcategory", params.subcategory);
  }
  if (params.search) {
    query = query.or(
      `name.ilike.%${params.search}%,description.ilike.%${params.search}%`
    );
  }
  if (params.minRating) {
    query = query.gte("average_rating", params.minRating);
  }

  query = query.order("average_rating", { ascending: false, nullsFirst: false });

  if (params.limit) {
    query = query.limit(params.limit);
  }
  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error searching attractions:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get attractions for a destination
 */
export async function getAttractionsByDestination(
  destinationId: string,
  limit = 50
): Promise<Attraction[]> {
  const { data, error } = await supabase
    .from("attractions")
    .select("*")
    .eq("destination_id", destinationId)
    .order("average_rating", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching attractions by destination:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get attraction by ID
 */
export async function getAttractionById(id: string): Promise<Attraction | null> {
  const { data, error } = await supabase
    .from("attractions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching attraction:", error);
    throw error;
  }

  return data;
}

/**
 * Get top-rated attractions
 */
export async function getTopRatedAttractions(
  limit = 10
): Promise<Attraction[]> {
  const { data, error } = await supabase
    .from("attractions")
    .select("*")
    .not("average_rating", "is", null)
    .order("average_rating", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching top-rated attractions:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get attractions by category
 */
export async function getAttractionsByCategory(
  category: string,
  limit = 20
): Promise<Attraction[]> {
  const { data, error } = await supabase
    .from("attractions")
    .select("*")
    .ilike("category", category)
    .order("average_rating", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching attractions by category:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get unique attraction categories
 */
export async function getAttractionCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("attractions")
    .select("category")
    .not("category", "is", null);

  if (error) {
    console.error("Error fetching attraction categories:", error);
    throw error;
  }

  const categories = [...new Set(data?.map((a) => a.category).filter(Boolean))] as string[];
  return categories.sort();
}

/**
 * Get attraction count by destination
 */
export async function getAttractionCountByDestination(
  destinationId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("attractions")
    .select("*", { count: "exact", head: true })
    .eq("destination_id", destinationId);

  if (error) {
    console.error("Error counting attractions:", error);
    throw error;
  }

  return count || 0;
}

/**
 * Get nearby attractions based on coordinates
 */
export async function getNearbyAttractions(
  lat: number,
  lon: number,
  radiusKm = 5,
  limit = 10
): Promise<Attraction[]> {
  // Approximate bounding box calculation
  const latDelta = radiusKm / 111; // 1 degree lat ≈ 111km
  const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const { data, error } = await supabase
    .from("attractions")
    .select("*")
    .gte("latitude", lat - latDelta)
    .lte("latitude", lat + latDelta)
    .gte("longitude", lon - lonDelta)
    .lte("longitude", lon + lonDelta)
    .limit(limit);

  if (error) {
    console.error("Error fetching nearby attractions:", error);
    throw error;
  }

  return data || [];
}
