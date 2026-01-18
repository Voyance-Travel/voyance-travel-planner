/**
 * Destination Images API Service
 * 
 * Uses Cloud edge function with Google Places Photos fallback.
 * Priority: Database → Google Places → Gradient fallback
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

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

/**
 * Get destination images with fallback chain:
 * Database → Google Places → Gradient
 */
export async function getDestinationImages(
  params: GetImagesParams = {}
): Promise<DestinationImage[]> {
  const queryParams = new URLSearchParams();
  
  if (params.destinationId) queryParams.set('destinationId', params.destinationId);
  if (params.destination) queryParams.set('destination', params.destination);
  if (params.imageType) queryParams.set('imageType', params.imageType);
  if (params.limit) queryParams.set('limit', String(params.limit));
  
  const { data, error } = await supabase.functions.invoke(`destination-images?${queryParams.toString()}`);
  
  if (error) {
    console.error('[Images] Edge function error:', error);
    // Return empty array on error - UI should handle gracefully
    return [];
  }
  
  return (data as ImagesResponse)?.images || [];
}

/**
 * Get hero image for a specific destination
 */
export async function getHeroImage(destinationId: string, destinationName?: string): Promise<DestinationImage | null> {
  const images = await getDestinationImages({
    destinationId,
    destination: destinationName,
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
    queryKey: ['destination-images', params],
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
    queryKey: ['hero-image', destinationId, destinationName],
    queryFn: () => getHeroImage(destinationId!, destinationName),
    enabled: !!destinationId || !!destinationName,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook to fetch gallery images
 */
export function useGalleryImages(destinationId: string | undefined, limit: number = 10) {
  return useQuery({
    queryKey: ['gallery-images', destinationId, limit],
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
    queryKey: ['activity-images', destinationId, limit],
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
