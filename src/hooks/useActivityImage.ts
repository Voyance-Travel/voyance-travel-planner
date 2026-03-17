/**
 * Hook for fetching activity photos using tiered real photo sources
 * Priority: Cache → Attractions/Activities DB → Curated DB → Google Places → TripAdvisor → Wikimedia → AI (last resort)
 * Falls back to static type-based images when no real photo is available.
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getActivityFallbackImage } from '@/utils/activityFallbackImages';

// ── localStorage cache with 7-day TTL ────────────────────────────────────────
const CACHE_KEY_PREFIX = 'voyance_photo_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getFromLocalCache(key: string): { url: string; source: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY_PREFIX + key);
      return null;
    }
    return { url: parsed.url, source: parsed.source };
  } catch {
    return null;
  }
}

function setLocalCache(key: string, url: string, source: string): void {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({ url, source, ts: Date.now() }));
  } catch {
    // localStorage full — ignore
  }
}

// In-memory cache for same-session dedup
const imageCache = new Map<string, { url: string; source: string }>();

// Pending requests to dedupe concurrent fetches
const pendingRequests = new Map<string, Promise<{ url: string; source: string } | null>>();

function getCategoryFallback(category?: string, title?: string): string {
  return getActivityFallbackImage(category, title);
}

// Strip common prefixes to deduplicate cache keys for the same venue
const STRIP_PREFIXES = /^(visit|explore|discover|tour|see|experience|dinner at|lunch at|breakfast at|stop at|walk to|head to|check out)\s+/i;

function getCacheKey(title: string, destination?: string, cacheId?: string): string {
  const cleanTitle = (cacheId || title).replace(STRIP_PREFIXES, '').trim();
  const normalized = `${cleanTitle}-${destination || 'unknown'}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 80);
  return normalized;
}

// ── Cross-share: Check attractions & activities tables ───────────────────────
async function fetchFromSharedTables(
  title: string,
  destination: string
): Promise<{ url: string; source: string } | null> {
  try {
    const cleanTitle = title.replace(STRIP_PREFIXES, '').trim();
    if (cleanTitle.length < 3) return null;

    // Try attractions table first (higher quality data)
    const { data: attraction } = await supabase
      .from('attractions')
      .select('image_url, name')
      .not('image_url', 'is', null)
      .ilike('name', `%${cleanTitle}%`)
      .limit(1);

    if (attraction?.[0]?.image_url) {
      return { url: attraction[0].image_url, source: 'shared_attraction' };
    }

    // Try activities table
    const { data: activity } = await supabase
      .from('activities')
      .select('image_url, name')
      .not('image_url', 'is', null)
      .ilike('name', `%${cleanTitle}%`)
      .limit(1);

    if (activity?.[0]?.image_url) {
      return { url: activity[0].image_url, source: 'shared_activity' };
    }

    return null;
  } catch {
    return null;
  }
}

// ── Write-back resolved photo to shared tables (fire-and-forget) ─────────────
function writeBackToSharedTables(title: string, photoUrl: string): void {
  const cleanTitle = title.replace(STRIP_PREFIXES, '').trim();
  if (cleanTitle.length < 3 || photoUrl.startsWith('data:')) return;

  // Try to match and update attractions table
  supabase
    .from('attractions')
    .update({ image_url: photoUrl })
    .is('image_url', null)
    .ilike('name', cleanTitle)
    .then(({ error }) => {
      if (!error) {
        // Also try activities table
        supabase
          .from('activities')
          .update({ image_url: photoUrl })
          .is('image_url', null)
          .ilike('name', cleanTitle)
          .then(() => { /* fire-and-forget */ });
      }
    });
}

// ── Check curated_images table ──────────────────────────────────────────────
async function fetchFromCuratedImages(
  title: string,
  category: string,
  destination: string
): Promise<{ url: string; source: string } | null> {
  try {
    const cleanTitle = title.trim().replace(/[^a-zA-Z0-9 ]/g, '');
    const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, '_');

    if (cleanTitle.length < 3) return null;

    // Attempt 1: exact entity_key match (fast)
    const { data: exactData } = await supabase
      .from('curated_images')
      .select('image_url, source')
      .eq('is_blacklisted', false)
      .eq('entity_key', normalizedTitle)
      .order('vote_score', { ascending: false })
      .limit(1);

    if (exactData?.[0]?.image_url) {
      return { url: exactData[0].image_url, source: `curated_${exactData[0].source || 'db'}` };
    }

    // Attempt 2: fuzzy search on entity_key and alt_text (unlocks Place ID-keyed rows)
    const { data, error } = await supabase
      .from('curated_images')
      .select('image_url, source')
      .eq('is_blacklisted', false)
      .or(`entity_key.ilike.%${cleanTitle}%,alt_text.ilike.%${cleanTitle}%`)
      .order('vote_score', { ascending: false })
      .limit(1);

    if (error || !data?.length) return null;
    if (!data[0].image_url) return null;
    return { url: data[0].image_url, source: `curated_${data[0].source || 'db'}` };
  } catch {
    return null;
  }
}

async function fetchImageFromBackend(
  title: string,
  category: string,
  destination: string
): Promise<{ url: string; source: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('destination-images', {
      body: {
        venueName: title,
        destination: destination,
        category: category,
        imageType: 'activity',
      },
    });

    if (error) return null;

    const image = data?.images?.[0];
    if (image?.url && image.source !== 'fallback') {
      return { url: image.url, source: image.source };
    }

    return null;
  } catch {
    return null;
  }
}

export function useActivityImage(
  title: string,
  category?: string,
  existingPhoto?: string | null,
  destination?: string,
  cacheId?: string,
  activityId?: string
): { 
  imageUrl: string | null; 
  loading: boolean; 
  source: string | null;
} {
  const [imageUrl, setImageUrl] = useState<string | null>(existingPhoto || null);
  const [loading, setLoading] = useState(!existingPhoto);
  const [source, setSource] = useState<string | null>(existingPhoto ? 'existing' : null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (existingPhoto) {
      setImageUrl(existingPhoto);
      setSource('existing');
      setLoading(false);
      return;
    }

    const skipCategories = ['transport', 'transportation', 'downtime', 'free_time'];
    if (skipCategories.includes(category?.toLowerCase() || '')) {
      setImageUrl(getCategoryFallback(category, title));
      setSource('fallback');
      setLoading(false);
      return;
    }

    const cacheKey = getCacheKey(title, destination, cacheId);

    // 1. In-memory cache
    if (imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey)!;
      setImageUrl(cached.url);
      setSource(cached.source);
      setLoading(false);
      return;
    }

    // 2. localStorage cache
    const localCached = getFromLocalCache(cacheKey);
    if (localCached) {
      imageCache.set(cacheKey, localCached);
      setImageUrl(localCached.url);
      setSource(localCached.source);
      setLoading(false);
      return;
    }

    // Dedup pending requests
    if (pendingRequests.has(cacheKey)) {
      pendingRequests.get(cacheKey)!.then((result) => {
        if (mountedRef.current) {
          if (result) {
            setImageUrl(result.url);
            setSource(result.source);
          } else {
            setImageUrl(getCategoryFallback(category, title));
            setSource('fallback');
          }
          setLoading(false);
        }
      });
      return;
    }

    if (!destination || destination.trim().length < 2) {
      setImageUrl(getCategoryFallback(category, title));
      setSource('fallback');
      setLoading(false);
      return;
    }

    // Show category fallback as placeholder while loading
    setImageUrl(getCategoryFallback(category, title));
    setLoading(true);

    // Tiered fetch: shared tables → curated_images → edge function
    const fetchPromise = (async (): Promise<{ url: string; source: string } | null> => {
      // 3. Try attractions/activities tables (cross-user shared photos — zero cost)
      const shared = await fetchFromSharedTables(title, destination);
      if (shared) return shared;

      // 4. Try curated_images table (fast, stable URLs)
      const curated = await fetchFromCuratedImages(title, category || 'activity', destination);
      if (curated) return curated;

      // 5. Fall back to edge function (Google Places, etc.)
      return fetchImageFromBackend(title, category || 'activity', destination);
    })();

    pendingRequests.set(cacheKey, fetchPromise);

    const timer = setTimeout(() => {
      fetchPromise.then((result) => {
        pendingRequests.delete(cacheKey);
        if (!mountedRef.current) return;

        if (result) {
          imageCache.set(cacheKey, result);
          setLocalCache(cacheKey, result.url, result.source);
          setImageUrl(result.url);
          setSource(result.source);

          // Write-back to shared tables so future users get this for free
          if (result.source !== 'shared_attraction' && result.source !== 'shared_activity') {
            writeBackToSharedTables(title, result.url);
          }
        } else {
          setSource('fallback');
        }
        setLoading(false);
      });
    }, 50 + Math.random() * 100);

    return () => clearTimeout(timer);
  }, [title, category, existingPhoto, destination, activityId]);

  return { imageUrl, loading, source };
}

export function getActivityPlaceholder(category?: string): string {
  return getCategoryFallback(category);
}

export function clearActivityImageCache(): void {
  imageCache.clear();
  pendingRequests.clear();
}
