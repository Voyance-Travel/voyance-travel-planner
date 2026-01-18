/**
 * Supabase Activities Service
 * Queries activities directly from the database
 */

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Activity = Tables<"activities">;

export interface ActivitySearchParams {
  destinationId?: string;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search activities with filters
 */
export async function searchActivities(
  params: ActivitySearchParams = {}
): Promise<Activity[]> {
  let query = supabase.from("activities").select("*");

  if (params.destinationId) {
    query = query.eq("destination_id", params.destinationId);
  }
  if (params.category) {
    query = query.ilike("category", params.category);
  }
  if (params.search) {
    query = query.or(
      `name.ilike.%${params.search}%,description.ilike.%${params.search}%`
    );
  }

  query = query.order("name");

  if (params.limit) {
    query = query.limit(params.limit);
  }
  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error searching activities:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get activities for a destination
 */
export async function getActivitiesByDestination(
  destinationId: string,
  limit = 50
): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("destination_id", destinationId)
    .order("name")
    .limit(limit);

  if (error) {
    console.error("Error fetching activities by destination:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get activity by ID
 */
export async function getActivityById(id: string): Promise<Activity | null> {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching activity:", error);
    throw error;
  }

  return data;
}

/**
 * Get activities by category
 */
export async function getActivitiesByCategory(
  category: string,
  limit = 20
): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .ilike("category", category)
    .order("name")
    .limit(limit);

  if (error) {
    console.error("Error fetching activities by category:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get unique activity categories
 */
export async function getActivityCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("category")
    .not("category", "is", null);

  if (error) {
    console.error("Error fetching activity categories:", error);
    throw error;
  }

  const categories = [...new Set(data?.map((a) => a.category).filter(Boolean))] as string[];
  return categories.sort();
}

/**
 * Get activity count by destination
 */
export async function getActivityCountByDestination(
  destinationId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("destination_id", destinationId);

  if (error) {
    console.error("Error counting activities:", error);
    throw error;
  }

  return count || 0;
}
