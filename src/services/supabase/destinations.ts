/**
 * Supabase Destinations Service
 * Queries destinations directly from the database
 */

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Destination = Tables<"destinations">;

export interface DestinationWithImages extends Destination {
  images: Tables<"destination_images">[];
}

export interface DestinationsFilterParams {
  region?: string;
  country?: string;
  featured?: boolean;
  tier?: number;
  costTier?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch destinations with optional filtering
 */
export async function getDestinations(
  params: DestinationsFilterParams = {}
): Promise<Destination[]> {
  let query = supabase.from("destinations").select("*");

  if (params.region) {
    query = query.eq("region", params.region);
  }
  if (params.country) {
    query = query.eq("country", params.country);
  }
  if (params.featured !== undefined) {
    query = query.eq("featured", params.featured);
  }
  if (params.tier !== undefined) {
    query = query.eq("tier", params.tier);
  }
  if (params.costTier) {
    query = query.eq("cost_tier", params.costTier);
  }
  if (params.search) {
    query = query.or(
      `city.ilike.%${params.search}%,country.ilike.%${params.search}%`
    );
  }

  query = query.order("city", { ascending: true });

  if (params.limit) {
    query = query.limit(params.limit);
  }
  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching destinations:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch a single destination by ID
 */
export async function getDestinationById(
  id: string
): Promise<Destination | null> {
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching destination:", error);
    throw error;
  }

  return data;
}

/**
 * Fetch destination by city name (case-insensitive)
 */
export async function getDestinationByCity(
  city: string
): Promise<Destination | null> {
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .ilike("city", city)
    .maybeSingle();

  if (error) {
    console.error("Error fetching destination by city:", error);
    throw error;
  }

  return data;
}

/**
 * Fetch destination with images
 */
export async function getDestinationWithImages(
  id: string
): Promise<DestinationWithImages | null> {
  const { data: destination, error: destError } = await supabase
    .from("destinations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (destError) {
    console.error("Error fetching destination:", destError);
    throw destError;
  }

  if (!destination) return null;

  const { data: images, error: imgError } = await supabase
    .from("destination_images")
    .select("*")
    .eq("destination_id", id);

  if (imgError) {
    console.error("Error fetching destination images:", imgError);
  }

  return {
    ...destination,
    images: images || [],
  };
}

/**
 * Search destinations by query
 */
export async function searchDestinations(
  query: string,
  limit = 10
): Promise<Destination[]> {
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .or(`city.ilike.%${query}%,country.ilike.%${query}%`)
    .limit(limit);

  if (error) {
    console.error("Error searching destinations:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get featured destinations
 */
export async function getFeaturedDestinations(
  limit = 6
): Promise<Destination[]> {
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .eq("featured", true)
    .limit(limit);

  if (error) {
    console.error("Error fetching featured destinations:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get destinations by region
 */
export async function getDestinationsByRegion(
  region: string,
  limit = 20
): Promise<Destination[]> {
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .eq("region", region)
    .limit(limit);

  if (error) {
    console.error("Error fetching destinations by region:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get unique regions from destinations
 */
export async function getDestinationRegions(): Promise<string[]> {
  const { data, error } = await supabase
    .from("destinations")
    .select("region")
    .not("region", "is", null);

  if (error) {
    console.error("Error fetching regions:", error);
    throw error;
  }

  const regions = [...new Set(data?.map((d) => d.region).filter(Boolean))] as string[];
  return regions.sort();
}

/**
 * Get unique countries from destinations
 */
export async function getDestinationCountries(): Promise<string[]> {
  const { data, error } = await supabase
    .from("destinations")
    .select("country")
    .not("country", "is", null);

  if (error) {
    console.error("Error fetching countries:", error);
    throw error;
  }

  const countries = [...new Set(data?.map((d) => d.country))] as string[];
  return countries.sort();
}
