/**
 * Hook for fetching activity photos using tiered real photo sources
 * Priority: Cache → Google Places → TripAdvisor → Wikimedia → AI (last resort)
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

    if (error) {
      return null;
    }

    const image = data?.images?.[0];
    if (image?.url && image.source !== 'fallback') {
      return { url: image.url, source: image.source };
    }

    return null;
  } catch (err) {
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
    // If we have an existing photo from the backend, use it
    if (existingPhoto) {
      setImageUrl(existingPhoto);
      setSource('existing');
      setLoading(false);
      return;
    }

    // Skip fetching for transport/downtime only - accommodation can now fetch hotel images
    const skipCategories = ['transport', 'transportation', 'downtime', 'free_time'];
    if (skipCategories.includes(category?.toLowerCase() || '')) {
      setImageUrl(getCategoryFallback(category, title));
      setSource('fallback');
      setLoading(false);
      return;
    }

    const cacheKey = getCacheKey(title, destination, cacheId);

    // Check in-memory cache first
    if (imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey)!;
      setImageUrl(cached.url);
      setSource(cached.source);
      setLoading(false);
      return;
    }

    // Check localStorage cache (survives page reload)
    const localCached = getFromLocalCache(cacheKey);
    if (localCached) {
      imageCache.set(cacheKey, localCached); // warm in-memory
      setImageUrl(localCached.url);
      setSource(localCached.source);
      setLoading(false);
      return;
    }

    // Check if there's already a pending request for this image
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

    // If destination is missing, don't attempt "real" venue lookup.
    if (!destination || destination.trim().length < 2) {
      setImageUrl(getCategoryFallback(category, title));
      setSource('fallback');
      setLoading(false);
      return;
    }

    // Set loading state with category fallback as placeholder
    setImageUrl(getCategoryFallback(category, title));
    setLoading(true);

    // Create the fetch promise
    const fetchPromise = fetchImageFromBackend(
      title,
      category || 'activity',
      destination
    );

    pendingRequests.set(cacheKey, fetchPromise);

    // Debounce slightly to batch rapid requests
    const timer = setTimeout(() => {
      fetchPromise.then((result) => {
        pendingRequests.delete(cacheKey);
        
        if (!mountedRef.current) return;

        if (result) {
          imageCache.set(cacheKey, result);
          setLocalCache(cacheKey, result.url, result.source);
          setImageUrl(result.url);
          setSource(result.source);

          // Persist photo URL to activity record so future loads skip the API
          if (activityId && result.source !== 'fallback') {
            persistPhotoToActivity(activityId, result.url).catch(() => {});
          }
        } else {
          // Keep the category fallback
          setSource('fallback');
        }
        setLoading(false);
      });
    }, 50 + Math.random() * 100);

    return () => clearTimeout(timer);
  }, [title, category, existingPhoto, destination, activityId]);

  return { imageUrl, loading, source };
}

// Pre-get a placeholder URL based on category (no API call, instant)
export function getActivityPlaceholder(category?: string): string {
  return getCategoryFallback(category);
}

// Clear the image cache (useful for testing or forced refresh)
export function clearActivityImageCache(): void {
  imageCache.clear();
  pendingRequests.clear();
  persistedActivityIds.clear();
}
