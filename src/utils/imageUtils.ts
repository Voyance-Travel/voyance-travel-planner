import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';

const img = toSiteImageUrlFromPhotoId;

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
 * Destination fallback images (served from Supabase storage)
 */
const DESTINATION_FALLBACKS: Record<string, string> = {
  kyoto: img('photo-1493976040374-85c8e12f0c0e'),
  lisbon: img('photo-1585208798174-6cedd86e019a'),
  tokyo: img('photo-1540959733332-eab4deabeeaf'),
  paris: img('photo-1502602898657-3e91760cbb34'),
  barcelona: img('photo-1583422409516-2895a77efed6'),
  'cape-town': img('photo-1580060839134-75a5edca2e99'),
  singapore: img('photo-1525625293386-3f8f99389edd'),
  default: img('photo-1476514525535-07fb3b4ae5f1')
};

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
 * Activity category fallback images (served from Supabase storage)
 */
const ACTIVITY_FALLBACKS: Record<string, string> = {
  culture: img('photo-1569974507005-6dc61f97fb5c'),
  food: img('photo-1414235077428-338989a2e8c0'),
  nature: img('photo-1501854140801-50d01698950b'),
  adventure: img('photo-1551632811-561732d1e306'),
  wellness: img('photo-1544161515-4ab6ce6db874'),
  nightlife: img('photo-1514525253161-7a46d19cd819'),
  transit: img('photo-1436491865332-7a61a109cc05'),
  hotel: img('photo-1566073771259-6a8506099945'),
  restaurant: img('photo-1517248135467-4c7edcad34c4'),
  default: img('photo-1488646953014-85cb44e25828')
};

export function getActivityFallback(category?: string): string {
  if (!category) {
    return ACTIVITY_FALLBACKS.default;
  }
  return ACTIVITY_FALLBACKS[category.toLowerCase()] || ACTIVITY_FALLBACKS.default;
}

export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const imgEl = new Image();
    imgEl.onload = () => resolve();
    imgEl.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    imgEl.src = src;
  });
}

export async function imageExists(src: string): Promise<boolean> {
  try {
    await preloadImage(src);
    return true;
  } catch {
    return false;
  }
}

export function getOptimizedImageUrl(
  src: string, 
  fallback?: string
): string {
  if (!src) {
    return fallback || DESTINATION_FALLBACKS.default;
  }
  return src;
}

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
 * Note: Only works with Supabase storage URLs that support transforms
 */
export function generateSrcSet(
  baseUrl: string,
  widths: number[] = [320, 640, 960, 1280]
): string {
  // For Supabase storage URLs or other internal URLs, return empty
  return '';
}
