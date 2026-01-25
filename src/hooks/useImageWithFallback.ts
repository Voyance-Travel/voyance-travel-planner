import { useState, useEffect, useCallback } from 'react';

// Generic fallback images for when all else fails
const GENERIC_FALLBACKS = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200', // Travel bags
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200', // Road trip
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200', // Lake mountains
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', // Beach
  'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1200', // Travel map
];

// Local storage key for tracking failed images
const FAILED_IMAGES_KEY = 'voyance_failed_images';
const FAILED_IMAGES_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

interface FailedImageEntry {
  url: string;
  failedAt: number;
}

// Get failed images from localStorage
function getFailedImages(): Map<string, number> {
  try {
    const stored = localStorage.getItem(FAILED_IMAGES_KEY);
    if (!stored) return new Map();
    
    const entries: FailedImageEntry[] = JSON.parse(stored);
    const now = Date.now();
    
    // Filter out old entries and return as Map
    const valid = entries.filter(e => now - e.failedAt < FAILED_IMAGES_MAX_AGE);
    return new Map(valid.map(e => [e.url, e.failedAt]));
  } catch {
    return new Map();
  }
}

// Save failed image to localStorage
function markImageAsFailed(url: string) {
  try {
    const failed = getFailedImages();
    failed.set(url, Date.now());
    
    const entries: FailedImageEntry[] = Array.from(failed.entries())
      .map(([url, failedAt]) => ({ url, failedAt }));
    
    localStorage.setItem(FAILED_IMAGES_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage errors
  }
}

// Check if image is known to be broken
function isImageKnownBroken(url: string): boolean {
  const failed = getFailedImages();
  return failed.has(url);
}

// Preload image to check if it works
function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
    
    // Timeout after 5 seconds
    setTimeout(() => resolve(false), 5000);
  });
}

// Get a deterministic fallback based on destination name
function getFallbackForDestination(destination: string): string {
  const hash = destination.toLowerCase().split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return GENERIC_FALLBACKS[hash % GENERIC_FALLBACKS.length];
}

interface UseImageWithFallbackOptions {
  primaryUrl: string;
  fallbackUrls?: string[];
  destination?: string;
}

interface UseImageWithFallbackResult {
  imageUrl: string;
  isLoading: boolean;
  hasFailed: boolean;
  retry: () => void;
}

/**
 * Hook that handles image loading with automatic fallback
 * Tracks failed images to avoid showing broken images again
 */
export function useImageWithFallback({
  primaryUrl,
  fallbackUrls = [],
  destination = '',
}: UseImageWithFallbackOptions): UseImageWithFallbackResult {
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);
  const [attemptIndex, setAttemptIndex] = useState(0);

  // Build ordered list of URLs to try
  const allUrls = [
    primaryUrl,
    ...fallbackUrls,
    getFallbackForDestination(destination),
  ].filter(Boolean);

  const tryNextImage = useCallback(async () => {
    setIsLoading(true);
    
    // Find first working URL
    for (let i = attemptIndex; i < allUrls.length; i++) {
      const url = allUrls[i];
      
      // Skip known broken images
      if (isImageKnownBroken(url)) {
        continue;
      }
      
      const works = await preloadImage(url);
      
      if (works) {
        setCurrentUrl(url);
        setIsLoading(false);
        setHasFailed(false);
        setAttemptIndex(i);
        return;
      } else {
        markImageAsFailed(url);
      }
    }
    
    // All URLs failed, use last resort fallback
    setCurrentUrl(getFallbackForDestination(destination));
    setIsLoading(false);
    setHasFailed(true);
  }, [allUrls, attemptIndex, destination]);

  useEffect(() => {
    setAttemptIndex(0);
    tryNextImage();
  }, [primaryUrl]);

  const retry = useCallback(() => {
    setAttemptIndex(0);
    tryNextImage();
  }, [tryNextImage]);

  return {
    imageUrl: currentUrl || getFallbackForDestination(destination),
    isLoading,
    hasFailed,
    retry,
  };
}

/**
 * Simple handler for img onError - switches to fallback
 */
export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackUrl?: string,
  destination?: string
) {
  const img = event.currentTarget;
  const originalSrc = img.src;
  
  // Mark as failed
  markImageAsFailed(originalSrc);
  
  // Set fallback
  if (fallbackUrl && !isImageKnownBroken(fallbackUrl)) {
    img.src = fallbackUrl;
  } else {
    img.src = getFallbackForDestination(destination || 'travel');
  }
}

/**
 * Get a working image URL, skipping known broken ones
 */
export function getWorkingImageUrl(urls: string[], destination: string): string {
  for (const url of urls) {
    if (!isImageKnownBroken(url)) {
      return url;
    }
  }
  return getFallbackForDestination(destination);
}

/**
 * Clear failed images cache (useful for debugging)
 */
export function clearFailedImagesCache() {
  localStorage.removeItem(FAILED_IMAGES_KEY);
}
