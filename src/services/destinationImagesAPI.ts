/**
 * Destination Images API Service
 * 
 * Uses Cloud edge function with Google Places Photos fallback.
 * Priority: DB cache → Hardcoded curated → Edge function → Gradient fallback
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  getDestinationImages as getCuratedDestinationImages,
  hasCuratedImages,
} from '@/utils/destinationImages';
import { normalizeUnsplashUrl } from '@/utils/unsplash';

// ============================================================================
// DB CACHE HELPERS
// ============================================================================

const CACHE_TTL_DAYS = 60;

/**
 * Check curated_images table for cached destination images.
 * Returns URLs if found and not expired, otherwise null.
 */
async function getDbCachedImages(
  destination: string,
  limit: number
): Promise<DestinationImage[] | null> {
  try {
    const normalizedKey = destination.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').slice(0, 100);
    const { data, error } = await supabase
      .from('curated_images')
      .select('*')
      .eq('entity_type', 'destination')
      .eq('entity_key', normalizedKey)
      .eq('is_blacklisted', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('vote_score', { ascending: false, nullsFirst: false })
      .order('quality_score', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error || !data || data.length === 0) return null;

    return data.map((row: any, i: number) => ({
      id: `db-cached-${i}`,
      url: normalizeImageUrl(row.image_url),
      alt: row.alt_text || `${destination} photo ${i + 1}`,
      type: 'hero' as const,
      source: 'database' as const,
    })).filter((img: DestinationImage) => !!img.url);
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget: seed curated_images table from hardcoded curated URLs.
 * Uses upsert so it's safe to call multiple times.
 */
function seedDbFromCurated(destination: string, urls: string[]): void {
  const normalizedKey = destination.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').slice(0, 100);
  const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Fire-and-forget — don't await, don't block UI
  Promise.all(
    urls.map((url, i) =>
      supabase.from('curated_images').upsert(
        {
          entity_type: 'destination',
          entity_key: normalizedKey,
          destination: destination,
          source: 'curated_local',
          image_url: url,
          alt_text: `${destination} photo ${i + 1}`,
          quality_score: 0.9,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'entity_type,entity_key,destination' }
      )
    )
  ).catch(() => { /* best-effort seeding */ });
}

// Bump to invalidate stale client-side caches after URL stabilization changes.
const IMAGE_QUERY_VERSION = 'img_v4_stable_city_urls';

// Destinations that MUST use curated images (no third-party sources allowed)
// These destinations have had issues with third-party APIs returning wrong/misleading images
const CURATED_ONLY_DESTINATIONS = new Set([
  // Major international cities
  'rome', 'lisbon', 'paris', 'london', 'barcelona', 'santorini', 'amsterdam',
  'vienna', 'copenhagen', 'florence', 'porto', 'tokyo', 'kyoto', 'bali',
  'bangkok', 'singapore', 'hong kong', 'seoul', 'new york', 'los angeles',
  'san francisco', 'miami', 'new orleans', 'hawaii', 'oahu', 'maui',
  'mexico city', 'cabo san lucas', 'cancun', 'buenos aires', 'rio de janeiro',
  'peru', 'cusco', 'oaxaca', 'cape town', 'marrakech', 'dubai', 'melbourne',
  'sydney', 'auckland', 'cartagena', 'vancouver', 'reykjavik',
  // US cities that were showing wrong images
  'baltimore', 'washington dc', 'washington', 'philadelphia', 'boston',
  'chicago', 'atlanta', 'denver', 'seattle', 'portland', 'nashville',
  'austin', 'las vegas',
  // African destinations with curated images
  'inhambane', 'mozambique', 'cairo', 'nairobi', 'johannesburg',
  // Small US towns (use generic scenic fallback rather than wrong API results)
  'thurmont', 'weymouth', 'weymouth township',
  // Recently added curated cities
  'casablanca', 'istanbul', 'prague', 'budapest', 'zurich', 'munich', 'edinburgh', 'dublin',
]);

function isCuratedOnlyDestination(destination?: string): boolean {
  if (!destination) return false;
  const d = destination.toLowerCase().trim();
  const cityOnly = d.split(',')[0]?.trim();
  return CURATED_ONLY_DESTINATIONS.has(cityOnly);
}

// ============================================================================
// TYPES
// ============================================================================

export type ImageType = 'hero' | 'gallery' | 'activity' | 'all';

export interface DestinationImage {
  id: string;
  url: string;
  alt: string;
  type: 'hero' | 'gallery' | 'activity';
  source: 'database' | 'google_places' | 'fallback';
  tags?: string[];
  width?: number | null;
  height?: number | null;
  photographer?: string | null;
}

export interface GetImagesParams {
  destinationId?: string;
  destination?: string;
  imageType?: ImageType;
  limit?: number;
  excludePeople?: boolean;
}

export interface ImagesResponse {
  success: boolean;
  images: DestinationImage[];
  source: 'database' | 'google_places' | 'fallback' | 'none';
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

function normalizeDestinationQuery(destination?: string): string | undefined {
  if (!destination) return undefined;
  return destination
    .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
    .replace(/\b(international\s+)?airport\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeImageUrl(url?: string | null): string {
  if (!url) return '';

  const value = url.trim();
  if (!value) return '';

  // Convert signed object URLs from public buckets to stable public URLs.
  const signedMatch = value.match(/^(https?:\/\/[^/]+)\/storage\/v1\/object\/sign\/([^?]+)(?:\?.*)?$/i);
  if (signedMatch) {
    return `${signedMatch[1]}/storage/v1/object/public/${signedMatch[2]}`;
  }

  // Strip noisy query params from public object URLs.
  if (value.includes('/storage/v1/object/public/')) {
    return value.split('?')[0];
  }

  return normalizeUnsplashUrl(value);
}

/**
 * Get destination images with fallback chain:
 * DB cache → Hardcoded curated (+ seed DB) → Edge function → Gradient
 */
export async function getDestinationImages(
  params: GetImagesParams = {}
): Promise<DestinationImage[]> {
  const normalizedDestination = normalizeDestinationQuery(params.destination);

  // For hero/gallery requests, check DB cache first, then hardcoded curated
  if (
    normalizedDestination &&
    (params.imageType === 'hero' || params.imageType === 'gallery' || params.imageType === 'all')
  ) {
    const type = (params.imageType === 'gallery' ? 'gallery' : 'hero') as DestinationImage['type'];
    const limit = params.limit ?? (params.imageType === 'gallery' ? 6 : 1);

    // TIER 1: Check curated_images DB table (fast, indexed query)
    const dbImages = await getDbCachedImages(normalizedDestination, limit);
    if (dbImages && dbImages.length > 0) {
      console.log('[Images] DB cache hit for:', normalizedDestination, dbImages.length, 'images');
      return dbImages;
    }

    // TIER 2: Fall back to hardcoded curated images + seed DB for next time
    if (hasCuratedImages(normalizedDestination)) {
      const urls = getCuratedDestinationImages(normalizedDestination, limit);
      // Fire-and-forget: seed the DB so next request hits TIER 1
      seedDbFromCurated(normalizedDestination, urls);
      return urls.map((url, i) => ({
        id: `curated-local-${type}-${i}`,
        url: normalizeImageUrl(url),
        alt: `${normalizedDestination} photo ${i + 1}`,
        type,
        source: 'database' as const,
      }));
    }

    // TIER 2b: For curated-only destinations with no hardcoded images, don't call API
    if (isCuratedOnlyDestination(normalizedDestination)) {
      return [];
    }
  }

  // Call backend function via POST body for reliability (no querystring invoke)
  const { data, error } = await supabase.functions.invoke('destination-images', {
    body: {
      destinationId: params.destinationId,
      destination: normalizedDestination,
      imageType: params.imageType,
      limit: params.limit,
    },
  });

  if (error) {
    console.error('[Images] Backend function error:', error);
    // Return empty array on error - UI should handle gracefully
    return [];
  }

  const images = (data as ImagesResponse)?.images || [];

  return images
    .map((image) => ({
      ...image,
      url: normalizeImageUrl(image.url),
    }))
    .filter((image) => !!image.url);
}

/**
 * Get hero image for a specific destination
 */
export async function getHeroImage(
  destinationId: string,
  destinationName?: string
): Promise<DestinationImage | null> {
  const images = await getDestinationImages({
    destinationId,
    destination: destinationName,
    imageType: 'hero',
    limit: 1,
  });

  return images[0] || null;
}

/**
 * Get hero image by destination name (when you don't have a backend destinationId)
 */
export async function getHeroImageByName(destination: string): Promise<DestinationImage | null> {
  const images = await getDestinationImages({
    destination,
    imageType: 'hero',
    limit: 1,
  });

  return images[0] || null;
}

/**
 * Get gallery images for a destination
 */
export async function getGalleryImages(
  destinationId: string,
  limit: number = 10
): Promise<DestinationImage[]> {
  return getDestinationImages({
    destinationId,
    imageType: 'gallery',
    limit,
  });
}

/**
 * Get activity images for a destination
 */
export async function getActivityImages(
  destinationId: string,
  limit: number = 5
): Promise<DestinationImage[]> {
  return getDestinationImages({
    destinationId,
    imageType: 'activity',
    limit,
  });
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook to fetch destination images with automatic fallback
 */
export function useDestinationImages(params: GetImagesParams = {}) {
  return useQuery({
    queryKey: ['destination-images', IMAGE_QUERY_VERSION, params],
    queryFn: () => getDestinationImages(params),
    enabled: !!(params.destinationId || params.destination),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook to fetch hero image for a destination
 */
export function useHeroImage(destinationId: string | undefined, destinationName?: string) {
  return useQuery({
    queryKey: ['hero-image', IMAGE_QUERY_VERSION, destinationId || null, destinationName || null],
    queryFn: () => {
      if (destinationId) return getHeroImage(destinationId, destinationName);
      return getHeroImageByName(destinationName!);
    },
    enabled: !!destinationId || !!destinationName,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook to fetch gallery images
 */
export function useGalleryImages(destinationId: string | undefined, limit: number = 10) {
  return useQuery({
    queryKey: ['gallery-images', IMAGE_QUERY_VERSION, destinationId, limit],
    queryFn: () => getGalleryImages(destinationId!, limit),
    enabled: !!destinationId,
    staleTime: 1000 * 60 * 60,
  });
}

/**
 * Hook to fetch activity images
 */
export function useActivityImages(destinationId: string | undefined, limit: number = 5) {
  return useQuery({
    queryKey: ['activity-images', IMAGE_QUERY_VERSION, destinationId, limit],
    queryFn: () => getActivityImages(destinationId!, limit),
    enabled: !!destinationId,
    staleTime: 1000 * 60 * 60,
  });
}

export default {
  getDestinationImages,
  getHeroImage,
  getGalleryImages,
  getActivityImages,
};
