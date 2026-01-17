/**
 * Destination Images API Service
 * Endpoints for destination images management
 */

import { useQuery } from '@tanstack/react-query';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// TYPES
// ============================================================================

export type ImageType = 'hero' | 'gallery' | 'activity' | 'all';

export interface DestinationImage {
  id: string;
  url: string;
  alt: string;
  type: 'hero' | 'gallery' | 'activity';
  tags: string[];
  width?: number | null;
  height?: number | null;
  photographer?: string | null;
  source?: string | null;
}

export interface GetImagesParams {
  destinationId?: string;
  imageType?: ImageType;
  limit?: number;
  excludePeople?: boolean;
}

export interface ImagesResponse {
  status: 'success';
  images: DestinationImage[];
}

export interface HeroImageResponse {
  status: 'success';
  image: DestinationImage;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get destination images with optional filtering
 */
export async function getDestinationImages(
  params: GetImagesParams = {}
): Promise<DestinationImage[]> {
  const queryParams = new URLSearchParams();
  
  if (params.destinationId) queryParams.set('destinationId', params.destinationId);
  if (params.imageType) queryParams.set('imageType', params.imageType);
  if (params.limit) queryParams.set('limit', String(params.limit));
  if (params.excludePeople !== undefined) queryParams.set('excludePeople', String(params.excludePeople));
  
  const url = `${BACKEND_URL}/api/v1/destination-images?${queryParams.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch destination images: ${response.statusText}`);
  }
  
  const data: ImagesResponse = await response.json();
  return data.images;
}

/**
 * Get hero image for a specific destination
 */
export async function getHeroImage(destinationId: string): Promise<DestinationImage> {
  const response = await fetch(`${BACKEND_URL}/api/v1/destination-images/hero/${destinationId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch hero image: ${response.statusText}`);
  }
  
  const data: HeroImageResponse = await response.json();
  return data.image;
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
 * Hook to fetch destination images
 */
export function useDestinationImages(params: GetImagesParams = {}) {
  return useQuery({
    queryKey: ['destination-images', params],
    queryFn: () => getDestinationImages(params),
    staleTime: 1000 * 60 * 60, // 1 hour (cached on backend)
  });
}

/**
 * Hook to fetch hero image for a destination
 */
export function useHeroImage(destinationId: string | undefined) {
  return useQuery({
    queryKey: ['hero-image', destinationId],
    queryFn: () => getHeroImage(destinationId!),
    enabled: !!destinationId,
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
