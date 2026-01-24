/**
 * Destination Images API Service
 * 
 * Uses Cloud edge function with Google Places Photos fallback.
 * Priority: Database → Google Places → Gradient fallback
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  getDestinationImages as getCuratedDestinationImages,
  hasCuratedImages,
} from '@/utils/destinationImages';

// Bump to invalidate any stale React Query caches that may still contain people photos.
const IMAGE_QUERY_VERSION = 'img_v2_no_people_rome';

function isRomeDestination(destination?: string): boolean {
  if (!destination) return false;
  const d = destination.toLowerCase().trim();
  const cityOnly = d.split(',')[0]?.trim();
  return cityOnly === 'rome';
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

/**
 * Get destination images with fallback chain:
 * Database → Google Places → Gradient
 */
export async function getDestinationImages(
  params: GetImagesParams = {}
): Promise<DestinationImage[]> {
  const normalizedDestination = normalizeDestinationQuery(params.destination);

  // Hard rule: Rome destination hero/gallery images must never come from third-party sources
  // (they can include people). Use our curated local assets instead.
  if (
    isRomeDestination(normalizedDestination) &&
    normalizedDestination &&
    (params.imageType === 'hero' || params.imageType === 'gallery' || params.imageType === 'all') &&
    hasCuratedImages(normalizedDestination)
  ) {
    const type = (params.imageType === 'gallery' ? 'gallery' : 'hero') as DestinationImage['type'];
    const limit = params.limit ?? (params.imageType === 'gallery' ? 6 : 1);
    const urls = getCuratedDestinationImages(normalizedDestination, limit);
    return urls.map((url, i) => ({
      id: `curated-local-${type}-${i}`,
      url,
      alt: `${normalizedDestination} photo ${i + 1}`,
      type,
      source: 'database',
    }));
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

  return (data as ImagesResponse)?.images || [];
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
