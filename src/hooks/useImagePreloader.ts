/**
 * Image Preloader Hook
 * 
 * Preloads and caches destination images on app initialization
 * so they appear instantly when navigating to the Explore page.
 */

import { useEffect, useRef } from 'react';
import { CURATED_DESTINATION_IMAGES, GENERIC_TRAVEL_IMAGES } from '@/utils/destinationImages';

// In-memory cache to track loaded images
const loadedImages = new Set<string>();
let preloadStarted = false;

/**
 * Preload a single image and cache it in the browser
 */
function preloadImage(src: string): Promise<void> {
  if (loadedImages.has(src)) {
    return Promise.resolve();
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      loadedImages.add(src);
      resolve();
    };
    img.onerror = () => {
      // Still mark as attempted to avoid retrying
      loadedImages.add(src);
      resolve();
    };
    img.src = src;
  });
}

/**
 * Preload all curated destination images
 */
async function preloadAllDestinationImages(): Promise<void> {
  if (preloadStarted) return;
  preloadStarted = true;
  
  console.log('[ImagePreloader] Starting background preload of destination images...');
  
  // Collect all unique image URLs
  const allImages: string[] = [];
  
  // Add curated destination images (first image of each destination for speed)
  Object.values(CURATED_DESTINATION_IMAGES).forEach((images) => {
    if (images[0]) {
      allImages.push(images[0]);
    }
  });
  
  // Add generic fallback images
  allImages.push(...GENERIC_TRAVEL_IMAGES);
  
  // Deduplicate
  const uniqueImages = [...new Set(allImages)];
  
  console.log(`[ImagePreloader] Preloading ${uniqueImages.length} destination images...`);
  
  // Load in batches to avoid overwhelming the browser
  const BATCH_SIZE = 6;
  for (let i = 0; i < uniqueImages.length; i += BATCH_SIZE) {
    const batch = uniqueImages.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(preloadImage));
    
    // Small delay between batches to keep UI responsive
    if (i + BATCH_SIZE < uniqueImages.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  console.log(`[ImagePreloader] ✓ Preloaded ${loadedImages.size} images`);
}

/**
 * Hook to trigger image preloading on app mount
 * Should be used once in the app root (e.g., App.tsx or a layout component)
 */
export function useImagePreloader() {
  const hasStarted = useRef(false);
  
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    
    // Start preloading after a short delay to not block initial render
    const timer = setTimeout(() => {
      preloadAllDestinationImages();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
}

/**
 * Check if an image is already cached
 */
export function isImageCached(src: string): boolean {
  return loadedImages.has(src);
}

/**
 * Get the number of cached images
 */
export function getCachedImageCount(): number {
  return loadedImages.size;
}

export default useImagePreloader;
