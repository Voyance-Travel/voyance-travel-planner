/**
 * Image Prefetching Utility
 * Preloads destination images before they're needed to avoid loading delays.
 *
 * Note: We persist cache to localStorage so moving between slides/pages doesn't
 * trigger redundant image fetches. Also seeds the curated_images DB table
 * so repeated trips to the same destination use DB cache instead of hardcoded.
 */

import { supabase } from '@/integrations/supabase/client';
import { getDestinationImages, hasCuratedImages } from '@/utils/destinationImages';

interface PrefetchedImage {
  url: string;
  destination: string;
  fetchedAt: number;
}

const imageCache = new Map<string, PrefetchedImage[]>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
// Bump cache key to invalidate any previously persisted destination images
// (e.g., a Rome image with people that got cached and kept reappearing).
const STORAGE_KEY = 'voyance_destination_image_cache_v3';

// Explicitly ban specific known-bad images (e.g., photos with people).
// Keep this list tight and only add URLs that must never be shown.
const BANNED_IMAGE_URLS = new Set<string>([
  'https://media-cdn.tripadvisor.com/media/photo-s/31/94/59/97/caption.jpg',
  // Lisbon tuk-tuk tourists image
  'https://media-cdn.tripadvisor.com/media/photo-s/1a/d6/08/7e/caption.jpg',
  'https://media-cdn.tripadvisor.com/media/photo-m/1280/1a/d6/08/7e/caption.jpg',
  'https://media-cdn.tripadvisor.com/media/photo-o/1a/d6/08/7e/caption.jpg',
]);

function filterBanned(urls: string[]): string[] {
  return urls.filter((u) => !!u && !BANNED_IMAGE_URLS.has(u));
}

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

    // If we have curated local images, cache & preload those instead of calling the backend.
    // This ensures we don't cache third-party images that may include people.
    if (hasCuratedImages(cleanDestination)) {
      const curatedUrls = filterBanned(getDestinationImages(cleanDestination, 4));
      if (curatedUrls.length > 0) {
        const curated: PrefetchedImage[] = curatedUrls.map((url) => ({
          url,
          destination: cleanDestination,
          fetchedAt: Date.now(),
        }));

        setCached(cleanKey, curated);

        curated.forEach((img) => {
          const pre = new Image();
          pre.decoding = 'async';
          pre.src = img.url;
        });

        console.log('[ImagePrefetch] Cached curated images for:', destination);
        return;
      }
    }

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

    const urls = filterBanned((data.images || []).map((img: any) => img?.url).filter(Boolean));
    if (urls.length === 0) {
      console.warn('[ImagePrefetch] Only banned/empty images returned for:', destination);
      return;
    }

    const images: PrefetchedImage[] = urls.map((url) => ({
      url,
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
