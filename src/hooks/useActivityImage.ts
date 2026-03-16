/**
 * Hook for fetching activity photos using tiered real photo sources
 * Priority: Cache → Curated DB → Google Places → TripAdvisor → Wikimedia → AI (last resort)
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

// Track which activity IDs we've already persisted to avoid duplicate writes
const persistedActivityIds = new Set<string>();

// UUID v4 pattern check
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getCategoryFallback(category?: string, title?: string): string {
  return getActivityFallbackImage(category, title);
}

function getCacheKey(title: string, destination?: string, cacheId?: string): string {
  const normalized = `${cacheId || title}-${destination || 'unknown'}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 80);
  return normalized;
}

async function persistPhotoToActivity(activityId: string, photoUrl: string): Promise<void> {
  if (!activityId || !UUID_REGEX.test(activityId)) return;
  if (persistedActivityIds.has(activityId)) return;
  persistedActivityIds.add(activityId);
  try {
    const { error } = await supabase
      .from('trip_activities')
      .update({ photos: [photoUrl] })
      .eq('id', activityId);
    if (error) {
      persistedActivityIds.delete(activityId);
      console.warn('[useActivityImage] Failed to persist photo:', error.message);
    }
  } catch {
    persistedActivityIds.delete(activityId);
  }
}

// ── NEW: Check curated_images table ──────────────────────────────────────────
async function fetchFromCuratedImages(
  title: string,
  category: string,
  destination: string
): Promise<{ url: string; source: string } | null> {
  try {
    const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, '_');
    const { data, error } = await supabase
      .from('curated_images')
      .select('image_url, source')
      .eq('is_blacklisted', false)
      .or(`entity_key.eq.${normalizedTitle},entity_key.ilike.%${title.trim().replace(/[^a-zA-Z0-9 ]/g, '')}%`)
      .order('vote_score', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    const row = data[0];
    if (!row.image_url) return null;
    return { url: row.image_url, source: `curated_${row.source || 'db'}` };
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

    // NEW: Tiered fetch — curated_images DB first, then edge function
    const fetchPromise = (async (): Promise<{ url: string; source: string } | null> => {
      // 3. Try curated_images table first (fast, stable URLs)
      const curated = await fetchFromCuratedImages(title, category || 'activity', destination);
      if (curated) return curated;

      // 4. Fall back to edge function (Google Places, etc.)
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

          if (activityId && result.source !== 'fallback') {
            persistPhotoToActivity(activityId, result.url).catch(() => {});
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
  persistedActivityIds.clear();
}
