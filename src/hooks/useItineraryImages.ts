/**
 * Batch image resolution hook for itinerary activities.
 * Resolves all activity images ONCE at itinerary level, eliminating per-row
 * useActivityImage hooks that caused React Error #310 (too many re-renders).
 *
 * Priority: localStorage cache → edge function (Google Places) → category fallback
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getActivityFallbackImage } from '@/utils/activityFallbackImages';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ActivityImageSpec {
  id: string;
  title: string;
  category?: string;
  existingPhoto?: string | null;
  locationName?: string;
}

// ── Cache helpers (shared with useActivityImage) ──────────────────────────────
const CACHE_KEY_PREFIX = 'voyance_photo_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getFromLocalCache(key: string): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY_PREFIX + key);
      return null;
    }
    return parsed.url;
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

function getCacheKey(title: string, destination: string): string {
  return `${title}-${destination}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 80);
}

// ── URL validation ────────────────────────────────────────────────────────────
/** Returns false for dead/unreliable Unsplash URLs */
function isValidPhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject bare Unsplash CDN URLs — these frequently 404 without notice
  if (/images\.unsplash\.com/i.test(trimmed)) return false;
  if (/source\.unsplash\.com/i.test(trimmed)) return false;

  // Accept internal storage, Google Places, data URIs, local paths
  return true;
}

// ── Batch fetch ───────────────────────────────────────────────────────────────
async function fetchImageFromBackend(
  title: string,
  category: string,
  destination: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('destination-images', {
      body: {
        venueName: title,
        destination,
        category,
        imageType: 'activity',
      },
    });
    if (error) return null;
    const image = data?.images?.[0];
    if (image?.url && image.source !== 'fallback') return image.url;
    return null;
  } catch {
    return null;
  }
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useItineraryImages(
  days: Array<{ activities: ActivityImageSpec[] }>,
  destination: string,
  canViewPremium: boolean = true
): Map<string, string> {
  const [imageMap, setImageMap] = useState<Map<string, string>>(new Map());
  const resolvedRef = useRef<Set<string>>(new Set());
  const runIdRef = useRef(0);

  // Build a stable fingerprint of activity IDs to detect changes
  const activityFingerprint = days
    .flatMap(d => d.activities.map(a => a.id))
    .join(',');

  useEffect(() => {
    if (!destination || destination.trim().length < 2 || !canViewPremium) return;

    const currentRun = ++runIdRef.current;

    async function resolveAll() {
      const newEntries: Array<[string, string]> = [];
      const toFetch: ActivityImageSpec[] = [];

      // Phase 1: Check caches synchronously
      for (const day of days) {
        for (const activity of day.activities) {
          if (!activity.id) continue;
          if (resolvedRef.current.has(activity.id)) continue;

          const cat = activity.category?.toLowerCase() || '';
          // Skip transport/downtime
          if (['transport', 'transportation', 'downtime', 'free_time'].includes(cat)) {
            const fb = getActivityFallbackImage(activity.category, activity.title);
            newEntries.push([activity.id, fb]);
            resolvedRef.current.add(activity.id);
            continue;
          }

          // Check if existing photo is valid
          if (isValidPhotoUrl(activity.existingPhoto)) {
            newEntries.push([activity.id, activity.existingPhoto!]);
            resolvedRef.current.add(activity.id);
            continue;
          }

          // Check localStorage cache
          const searchTerm = activity.locationName && activity.locationName.length > 3
            ? activity.locationName
            : activity.title;
          const cacheKey = getCacheKey(searchTerm, destination);
          const cached = getFromLocalCache(cacheKey);
          if (cached) {
            newEntries.push([activity.id, cached]);
            resolvedRef.current.add(activity.id);
            continue;
          }

          // Needs fetch
          toFetch.push(activity);
        }
      }

      // Apply cache hits immediately
      if (newEntries.length > 0 && currentRun === runIdRef.current) {
        setImageMap(prev => {
          const next = new Map(prev);
          for (const [id, url] of newEntries) next.set(id, url);
          return next;
        });
      }

      // Phase 2: Fetch missing images (batched with small delays to avoid hammering)
      for (let i = 0; i < toFetch.length; i++) {
        if (currentRun !== runIdRef.current) return; // cancelled

        const activity = toFetch[i];
        const searchTerm = activity.locationName && activity.locationName.length > 3
          ? activity.locationName
          : activity.title;
        const cacheKey = getCacheKey(searchTerm, destination);

        const url = await fetchImageFromBackend(
          searchTerm,
          activity.category || 'activity',
          destination
        );

        if (currentRun !== runIdRef.current) return; // cancelled

        const finalUrl = url || getActivityFallbackImage(activity.category, activity.title);

        if (url) {
          setLocalCache(cacheKey, url, 'google_places');
        }

        resolvedRef.current.add(activity.id);
        setImageMap(prev => {
          const next = new Map(prev);
          next.set(activity.id, finalUrl);
          return next;
        });

        // Small delay between fetches to avoid rate limiting
        if (i < toFetch.length - 1) {
          await new Promise(r => setTimeout(r, 80 + Math.random() * 120));
        }
      }
    }

    resolveAll();
  }, [activityFingerprint, destination, canViewPremium]);

  return imageMap;
}

/**
 * Extract minimal image specs from EditorialDay activities.
 * Call this in the parent component to prepare data for useItineraryImages.
 */
export function extractImageSpecs(
  days: Array<{ activities: Array<{
    id: string;
    title: string;
    category?: string;
    type?: string;
    photos?: Array<{ url: string } | string>;
    location?: { name?: string };
  }> }>
): Array<{ activities: ActivityImageSpec[] }> {
  return days.map(day => ({
    activities: day.activities.map(a => {
      let existingPhoto: string | null = null;
      if (a.photos && a.photos.length > 0) {
        const p = a.photos[0];
        existingPhoto = typeof p === 'string' ? p : p?.url || null;
      }
      return {
        id: a.id,
        title: a.title,
        category: a.category || a.type,
        existingPhoto,
        locationName: a.location?.name,
      };
    }),
  }));
}
