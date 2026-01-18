/**
 * Image Prefetching Utility
 * Preloads destination images before they're needed to avoid loading delays.
 *
 * Note: We persist cache to localStorage so moving between slides/pages doesn't
 * trigger redundant image fetches.
 */

import { supabase } from '@/integrations/supabase/client';

interface PrefetchedImage {
  url: string;
  destination: string;
  fetchedAt: number;
}

const imageCache = new Map<string, PrefetchedImage[]>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const STORAGE_KEY = 'voyance_destination_image_cache_v1';

function normalizeDestination(destination: string): string {
  return (destination || '')
    .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
    .trim()
    .toLowerCase();
}

function readStoredCache(): Record<string, PrefetchedImage[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PrefetchedImage[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredCache(cache: Record<string, PrefetchedImage[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota / privacy mode issues
  }
}

function getValidCached(key: string): PrefetchedImage[] | null {
  const mem = imageCache.get(key);
  if (mem && mem.length > 0 && Date.now() - mem[0]!.fetchedAt < CACHE_TTL) return mem;

  const stored = readStoredCache();
  const fromStorage = stored[key];
  if (fromStorage && fromStorage.length > 0 && Date.now() - fromStorage[0]!.fetchedAt < CACHE_TTL) {
    imageCache.set(key, fromStorage);
    return fromStorage;
  }

  return null;
}

function setCached(key: string, images: PrefetchedImage[]): void {
  imageCache.set(key, images);
  const stored = readStoredCache();
  stored[key] = images;
  writeStoredCache(stored);
}

/**
 * Prefetch destination images in the background
 */
export async function prefetchDestinationImages(destination: string): Promise<void> {
  const cleanKey = normalizeDestination(destination);
  if (!cleanKey) return;

  // Check if already cached and not stale
  const existing = getValidCached(cleanKey);
  if (existing) {
    console.log('[ImagePrefetch] Already cached:', destination);
    return;
  }

  console.log('[ImagePrefetch] Starting prefetch for:', destination);

  try {
    const cleanDestination = destination.replace(/\s*\([A-Z]{3}\)\s*$/i, '').trim();

    const { data, error } = await supabase.functions.invoke('destination-images', {
      body: {
        destination: cleanDestination,
        imageType: 'hero',
        limit: 4,
      },
    });

    if (error || !data?.images?.length) {
      console.warn('[ImagePrefetch] No images found for:', destination);
      return;
    }

    const images: PrefetchedImage[] = data.images.map((img: any) => ({
      url: img.url,
      destination: cleanDestination,
      fetchedAt: Date.now(),
    }));

    setCached(cleanKey, images);

    // Preload images into browser cache
    images.forEach((img) => {
      const pre = new Image();
      pre.decoding = 'async';
      pre.src = img.url;
    });

    console.log('[ImagePrefetch] Cached', images.length, 'images for:', destination);
  } catch (error) {
    console.warn('[ImagePrefetch] Error prefetching:', error);
  }
}

/**
 * Get cached images for a destination
 */
export function getCachedImages(destination: string): string[] {
  const key = normalizeDestination(destination);
  if (!key) return [];

  const cached = getValidCached(key);
  if (cached) return cached.map((img) => img.url);

  return [];
}

/**
 * Prefetch images for multiple destinations
 */
export async function prefetchMultipleDestinations(destinations: string[]): Promise<void> {
  const uniqueDestinations = [...new Set(destinations)];
  await Promise.all(uniqueDestinations.map(prefetchDestinationImages));
}

/**
 * Clear image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
