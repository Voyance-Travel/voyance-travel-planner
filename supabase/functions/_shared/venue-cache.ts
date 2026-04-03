/**
 * Shared Venue Cache Utility
 * 
 * Cross-function cache for Google Places lookups. When one edge function
 * (e.g. fetch-reviews) resolves a venue's Place ID, photo URL, and metadata,
 * other functions (destination-images, recommend-restaurants, etc.) can
 * reuse it without calling Google again.
 * 
 * Uses the `verified_venues` table as the shared store.
 */

import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Common venue name prefixes to strip for cache key normalization
const VENUE_PREFIXES = /^(ristorante|trattoria|osteria|pizzeria|café|cafe|the|hotel|restaurant|bar|pub|bistro|brasserie|taverna|locanda|enoteca|gelateria|pasticceria|boulangerie|konditorei)\s+/i;

function normalizeVenueName(name: string): string {
  return name
    .replace(VENUE_PREFIXES, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

export interface VenueCacheEntry {
  placeId: string;
  name: string;
  photoUrl?: string;
  address?: string;
  rating?: number;
  totalReviews?: number;
  types?: string[];
  coordinates?: { lat: number; lng: number };
}

/**
 * Check the shared venue cache for a previously resolved venue.
 * Returns null on miss.
 */
export async function checkVenueCache(
  venueName: string,
  destination: string
): Promise<VenueCacheEntry | null> {
  try {
    const normalized = normalizeVenueName(venueName);
    if (normalized.length < 3) return null;

    const supabase = getSupabase();

    // Try exact match first
    const { data } = await supabase
      .from('verified_venues')
      .select('place_id, name, photo_url, address, rating, total_reviews, types, latitude, longitude')
      .ilike('name', `%${normalized}%`)
      .ilike('destination', `%${destination}%`)
      .order('usage_count', { ascending: false })
      .limit(1);

    if (!data?.[0]) return null;

    const row = data[0];

    // Bump usage count (fire-and-forget)
    supabase
      .from('verified_venues')
      .update({ usage_count: (row as any).usage_count + 1 || 1 })
      .eq('place_id', row.place_id)
      .then(() => {});

    return {
      placeId: row.place_id,
      name: row.name,
      photoUrl: row.photo_url || undefined,
      address: row.address || undefined,
      rating: row.rating || undefined,
      totalReviews: row.total_reviews || undefined,
      types: row.types ? (Array.isArray(row.types) ? row.types : []) : undefined,
      coordinates: row.latitude && row.longitude
        ? { lat: row.latitude, lng: row.longitude }
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Store a resolved venue in the shared cache for cross-function reuse.
 */
export async function cacheVenueResult(
  venueName: string,
  destination: string,
  entry: VenueCacheEntry
): Promise<void> {
  try {
    const supabase = getSupabase();

    await supabase
      .from('verified_venues')
      .upsert({
        place_id: entry.placeId,
        name: entry.name,
        destination: destination,
        photo_url: entry.photoUrl || null,
        address: entry.address || null,
        rating: entry.rating || null,
        total_reviews: entry.totalReviews || null,
        types: entry.types || null,
        latitude: entry.coordinates?.lat || null,
        longitude: entry.coordinates?.lng || null,
        usage_count: 1,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      }, { onConflict: 'place_id' });
  } catch (e) {
    console.warn('[VenueCache] Failed to cache venue:', e);
  }
}
