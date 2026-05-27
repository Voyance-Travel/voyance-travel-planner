/**
 * Hero image cross-city guard.
 *
 * Closes "Madrid photo on a Barcelona trip" class. Root cause: the only seeded /
 * canonical URL guard (`isUntrustedHeroUrl`) checks host + people-content slugs,
 * not whether the photo's destination matches the trip's destination. When a
 * trip persists `metadata.hero_image` pointing at another city's canonical
 * photo (stale write, prior canonical bug, manual override), the resolver
 * tier-1 short-circuits to that URL forever.
 *
 * We extract the photo-id slug from a `site-images/photo-XXXX…` URL and look
 * up which destination row's `hero_image_url`/`stock_image_url` it belongs to.
 * If the hinted city differs from the trip's destination city, the URL is
 * cross-city and the resolver should advance past that tier.
 *
 * One-shot lookup per slug, cached in module scope. Steady-state (URL matches
 * the trip's own city) is a no-op after first resolve.
 */

import { supabase } from '@/integrations/supabase/client';

const slugCityCache = new Map<string, Promise<string | null>>();

function extractPhotoSlug(url: string): string | null {
  if (!url) return null;
  // Match …/site-images/photo-1539037116277-4db20889f2d4(.jpg)? or anywhere in path
  const m = url.match(/\/(photo-[a-z0-9-]+?)(?:\.[a-z]+)?(?:\?|$)/i);
  return m ? m[1].toLowerCase() : null;
}

function normalizeCity(input: string | null | undefined): string {
  if (!input) return '';
  return input.split(',')[0].trim().toLowerCase();
}

async function resolveSlugCity(slug: string): Promise<string | null> {
  if (slugCityCache.has(slug)) return slugCityCache.get(slug)!;
  const p = (async () => {
    try {
      const like = `%${slug}%`;
      const { data, error } = await supabase
        .from('destinations')
        .select('city, hero_image_url, stock_image_url')
        .or(`hero_image_url.ilike.${like},stock_image_url.ilike.${like}`)
        .limit(1);
      if (error || !data || data.length === 0) return null;
      return normalizeCity((data[0] as { city?: string }).city) || null;
    } catch {
      return null;
    }
  })();
  slugCityCache.set(slug, p);
  return p;
}

/**
 * Returns the hinted destination city for a hero URL, or null if it can't be
 * mapped (non-canonical host, unknown slug, etc.).
 */
export async function urlCityHint(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const slug = extractPhotoSlug(url);
  if (!slug) return null;
  return resolveSlugCity(slug);
}

/**
 * True if the URL is confidently a different city's photo than `destination`.
 * Returns false when there's no hint or the hint matches — never punish
 * unresolvable URLs (storage-map heroes, gradients, etc.).
 */
export async function isCrossCityHero(
  url: string | null | undefined,
  destination: string | null | undefined,
): Promise<boolean> {
  if (!url || !destination) return false;
  const hint = await urlCityHint(url);
  if (!hint) return false;
  const dest = normalizeCity(destination);
  if (!dest) return false;
  return hint !== dest;
}

/** Test helper — DO NOT call from app code. */
export function __resetHeroCrossCityCache() {
  slugCityCache.clear();
}
