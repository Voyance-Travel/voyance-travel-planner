/**
 * Image dimensions for critical images (CLS optimization)
 */
export const IMAGE_DIMENSIONS = {
  hero: { width: 1920, height: 1080 },
  card: { width: 640, height: 360 },
  thumbnail: { width: 320, height: 180 },
  icon: { width: 64, height: 64 },
  avatar: { width: 128, height: 128 },
  default: { width: 800, height: 600 }
} as const;

/**
 * Destination fallback images
 */
const DESTINATION_FALLBACKS: Record<string, string> = {
  kyoto: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80',
  lisbon: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200&q=80',
  tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80',
  paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
  barcelona: 'https://images.unsplash.com/photo-1583422409516-2895a77efed6?w=1200&q=80',
  'cape-town': 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200&q=80',
  singapore: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=80',
  default: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80'
};

/**
 * Get fallback image for destination
 */
export function getDestinationFallback(destination: string): string {
  if (!destination) {
    return DESTINATION_FALLBACKS.default;
  }
  
  const normalized = destination.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  return DESTINATION_FALLBACKS[normalized] || DESTINATION_FALLBACKS.default;
}

/**
 * Activity category fallback images
 */
const ACTIVITY_FALLBACKS: Record<string, string> = {
  culture: 'https://images.unsplash.com/photo-1569974507005-6dc61f97fb5c?w=600&q=80',
  food: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
  nature: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80',
  adventure: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80',
  wellness: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80',
  nightlife: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
  transit: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80',
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80',
  restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
  default: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80'
};

/**
 * Get fallback image for activity category
 */
export function getActivityFallback(category?: string): string {
  if (!category) {
    return ACTIVITY_FALLBACKS.default;
  }
  return ACTIVITY_FALLBACKS[category.toLowerCase()] || ACTIVITY_FALLBACKS.default;
}

/**
 * Preload an image
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Check if image exists
 */
export async function imageExists(src: string): Promise<boolean> {
  try {
    await preloadImage(src);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get optimized image URL with fallback
 */
export function getOptimizedImageUrl(
  src: string, 
  fallback?: string
): string {
  if (!src) {
    return fallback || DESTINATION_FALLBACKS.default;
  }
  return src;
}

/**
 * Get a generic fallback image based on category
 */
export function getFallbackImage(category?: string): string {
  const fallbacks: Record<string, string> = {
    destination: DESTINATION_FALLBACKS.default,
    activity: ACTIVITY_FALLBACKS.default,
    hotel: ACTIVITY_FALLBACKS.hotel,
    flight: ACTIVITY_FALLBACKS.transit,
    default: DESTINATION_FALLBACKS.default
  };
  
  return fallbacks[category || 'default'] || fallbacks.default;
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(
  baseUrl: string,
  widths: number[] = [320, 640, 960, 1280]
): string {
  // If it's an unsplash URL, we can use their resize params
  if (baseUrl.includes('unsplash.com')) {
    return widths
      .map(w => {
        const url = baseUrl.replace(/w=\d+/, `w=${w}`);
        return `${url} ${w}w`;
      })
      .join(', ');
  }
  
  // For other URLs, return empty (let browser use default)
  return '';
}
