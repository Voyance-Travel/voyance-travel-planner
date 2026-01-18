/**
 * Image Prefetching Utility
 * Preloads destination images before they're needed to avoid loading delays
 */

import { supabase } from '@/integrations/supabase/client';

interface PrefetchedImage {
  url: string;
  destination: string;
  fetchedAt: number;
}

const imageCache = new Map<string, PrefetchedImage[]>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Prefetch destination images in the background
 */
export async function prefetchDestinationImages(destination: string): Promise<void> {
  const cacheKey = destination.toLowerCase().trim();
  
  // Check if already cached and not stale
  const cached = imageCache.get(cacheKey);
  if (cached && Date.now() - cached[0]?.fetchedAt < CACHE_TTL) {
    console.log('[ImagePrefetch] Already cached:', destination);
    return;
  }

  console.log('[ImagePrefetch] Starting prefetch for:', destination);

  try {
    const cleanDestination = destination
      .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
      .trim();

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

    // Cache the image URLs
    const images: PrefetchedImage[] = data.images.map((img: any) => ({
      url: img.url,
      destination: cleanDestination,
      fetchedAt: Date.now(),
    }));
    imageCache.set(cacheKey, images);

    // Preload images into browser cache
    images.forEach((img) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'image';
      link.href = img.url;
      document.head.appendChild(link);
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
  const cacheKey = destination.toLowerCase().trim();
  const cached = imageCache.get(cacheKey);
  
  if (cached && Date.now() - cached[0]?.fetchedAt < CACHE_TTL) {
    return cached.map(img => img.url);
  }
  
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
}