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
  _activityId?: string // kept for API compat, no longer used for DB write-back
): { 
  imageUrl: string | null; 
  loading: boolean; 
  source: string | null;
} {
  const [imageUrl, setImageUrl] = useState<string | null>(existingPhoto || null);
  const [loading, setLoading] = useState(!existingPhoto);
  const [source, setSource] = useState<string | null>(existingPhoto ? 'existing' : null);
  const mountedRef = useRef(true);
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // If we have an existing photo from the backend, use it
    if (existingPhoto) {
      setImageUrl(prev => prev === existingPhoto ? prev : existingPhoto);
      setSource(prev => prev === 'existing' ? prev : 'existing');
      setLoading(false);
      return;
    }

    // Skip fetching for transport/downtime only
    const skipCategories = ['transport', 'transportation', 'downtime', 'free_time'];
    if (skipCategories.includes(category?.toLowerCase() || '')) {
      const fb = getCategoryFallback(category, title);
      setImageUrl(prev => prev === fb ? prev : fb);
      setSource(prev => prev === 'fallback' ? prev : 'fallback');
      setLoading(false);
      return;
    }

    const cacheKey = getCacheKey(title, destination, cacheId);

    // Skip if we already processed this exact key
    if (lastKeyRef.current === cacheKey) {
      return;
    }
    lastKeyRef.current = cacheKey;

    // Check in-memory cache first
    if (imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey)!;
      setImageUrl(prev => prev === cached.url ? prev : cached.url);
      setSource(prev => prev === cached.source ? prev : cached.source);
      setLoading(false);
      return;
    }

    // Check localStorage cache (survives page reload)
    const localCached = getFromLocalCache(cacheKey);
    if (localCached) {
      imageCache.set(cacheKey, localCached); // warm in-memory
      setImageUrl(prev => prev === localCached.url ? prev : localCached.url);
      setSource(prev => prev === localCached.source ? prev : localCached.source);
      setLoading(false);
      return;
    }

    // Check if there's already a pending request for this image
    if (pendingRequests.has(cacheKey)) {
      pendingRequests.get(cacheKey)!.then((result) => {
        if (mountedRef.current) {
          if (result) {
            setImageUrl(prev => prev === result.url ? prev : result.url);
            setSource(prev => prev === result.source ? prev : result.source);
          } else {
            const fb = getCategoryFallback(category, title);
            setImageUrl(prev => prev === fb ? prev : fb);
            setSource(prev => prev === 'fallback' ? prev : 'fallback');
          }
          setLoading(false);
        }
      });
      return;
    }

    // If destination is missing, don't attempt "real" venue lookup.
    if (!destination || destination.trim().length < 2) {
      const fb = getCategoryFallback(category, title);
      setImageUrl(prev => prev === fb ? prev : fb);
      setSource(prev => prev === 'fallback' ? prev : 'fallback');
      setLoading(false);
      return;
    }

    // Set loading state with category fallback as placeholder
    const placeholder = getCategoryFallback(category, title);
    setImageUrl(prev => prev === placeholder ? prev : placeholder);
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
          setImageUrl(prev => prev === result.url ? prev : result.url);
          setSource(prev => prev === result.source ? prev : result.source);
          // DB write-back removed to prevent refetch → re-render loops.
          // localStorage cache (7-day TTL) is sufficient.
        } else {
          // Keep the category fallback
          setSource(prev => prev === 'fallback' ? prev : 'fallback');
        }
        setLoading(false);
      });
    }, 50 + Math.random() * 100);

    return () => clearTimeout(timer);
  }, [title, category, existingPhoto, destination, cacheId]);

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
}
