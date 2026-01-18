/**
 * Supabase Guides Service
 * Queries guides directly from the database
 */

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Guide = Tables<"guides">;

export interface GuidesFilterParams {
  category?: string;
  city?: string;
  country?: string;
  featured?: boolean;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get published guides with optional filtering
 */
export async function getGuides(
  params: GuidesFilterParams = {}
): Promise<Guide[]> {
  let query = supabase
    .from("guides")
    .select("*")
    .eq("published", true);

  if (params.category) {
    query = query.ilike("category", params.category);
  }
  if (params.city) {
    query = query.ilike("destination_city", params.city);
  }
  if (params.country) {
    query = query.ilike("destination_country", params.country);
  }
  if (params.featured !== undefined) {
    query = query.eq("featured", params.featured);
  }
  if (params.search) {
    query = query.or(
      `title.ilike.%${params.search}%,excerpt.ilike.%${params.search}%`
    );
  }

  query = query.order("created_at", { ascending: false });

  if (params.limit) {
    query = query.limit(params.limit);
  }
  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching guides:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get a guide by slug
 */
export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) {
    console.error("Error fetching guide by slug:", error);
    throw error;
  }

  return data;
}

/**
 * Get a guide by ID
 */
export async function getGuideById(id: string): Promise<Guide | null> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching guide:", error);
    throw error;
  }

  return data;
}

/**
 * Get featured guides
 */
export async function getFeaturedGuides(limit = 6): Promise<Guide[]> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("published", true)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching featured guides:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get guides by category
 */
export async function getGuidesByCategory(
  category: string,
  limit = 10
): Promise<Guide[]> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("published", true)
    .ilike("category", category)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching guides by category:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get guides for a destination
 */
export async function getGuidesByDestination(
  city: string,
  country?: string,
  limit = 10
): Promise<Guide[]> {
  let query = supabase
    .from("guides")
    .select("*")
    .eq("published", true)
    .ilike("destination_city", city);

  if (country) {
    query = query.ilike("destination_country", country);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching guides by destination:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get unique guide categories
 */
export async function getGuideCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("guides")
    .select("category")
    .eq("published", true)
    .not("category", "is", null);

  if (error) {
    console.error("Error fetching guide categories:", error);
    throw error;
  }

  const categories = [...new Set(data?.map((g) => g.category).filter(Boolean))] as string[];
  return categories.sort();
}

/**
 * Search guides
 */
export async function searchGuides(
  query: string,
  limit = 10
): Promise<Guide[]> {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("published", true)
    .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,subtitle.ilike.%${query}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error searching guides:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get related guides by tags
 */
export async function getRelatedGuides(
  guideId: string,
  tags: string[],
  limit = 3
): Promise<Guide[]> {
  // This is a simple implementation - for production, consider a more sophisticated matching algorithm
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("published", true)
    .neq("id", guideId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching related guides:", error);
    throw error;
  }

  return data || [];
}
