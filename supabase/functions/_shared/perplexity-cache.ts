/**
 * Shared Perplexity caching utilities for edge functions.
 * Uses the search_cache table to avoid redundant API calls.
 */
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );
}

/**
 * Build a normalized cache key.
 * @param prefix - e.g. "attraction", "activity-url", "restaurant-url"
 * @param parts  - variable key segments (name, destination, etc.)
 */
export function buildCacheKey(prefix: string, ...parts: (string | undefined)[]): string {
  const normalized = [prefix, ...parts.filter(Boolean)]
    .map(p => (p ?? '').toLowerCase().trim().replace(/\s+/g, '_'))
    .join(':');
  return normalized.substring(0, 255);
}

/**
 * Look up a cached result. Returns null on miss or expiry.
 */
export async function getCached<T = unknown>(cacheKey: string): Promise<T | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('search_cache')
      .select('results')
      .eq('search_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;
    console.log(`[cache] HIT: ${cacheKey}`);
    return data.results as T;
  } catch {
    return null;
  }
}

/**
 * Write a result to the cache with a TTL.
 * @param ttlMs - time-to-live in milliseconds
 */
export async function setCache(
  cacheKey: string,
  searchType: string,
  results: unknown,
  ttlMs: number,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    await supabase
      .from('search_cache')
      .upsert({
        search_key: cacheKey,
        search_type: searchType,
        results,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }, { onConflict: 'search_key' });

    console.log(`[cache] SET: ${cacheKey} (TTL ${Math.round(ttlMs / 3600000)}h)`);
  } catch (error) {
    console.error('[cache] Write error:', error);
  }
}

// Common TTLs
export const TTL = {
  SIX_HOURS:    6 * 60 * 60 * 1000,
  ONE_DAY:     24 * 60 * 60 * 1000,
  SEVEN_DAYS:   7 * 24 * 60 * 60 * 1000,
  THIRTY_DAYS: 30 * 24 * 60 * 60 * 1000,
  NINETY_DAYS: 90 * 24 * 60 * 60 * 1000,
} as const;
