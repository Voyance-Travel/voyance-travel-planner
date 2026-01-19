import { useMemo } from 'react';
import HeroImageWithFallback from '@/components/common/HeroImageWithFallback';
import { useHeroImage } from '@/services/destinationImagesAPI';

interface DestinationHeroImageProps {
  destinationId?: string;
  destinationName: string;
  alt?: string;
  className?: string;
  /**
   * Pass "" to disable overlay (most callers already render their own overlay)
   */
  overlayGradient?: string;
}

function generateGradientDataUrl(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${hue1},60%,40%)"/>
        <stop offset="100%" style="stop-color:hsl(${hue2},70%,30%)"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" font-family="system-ui" font-size="52" fill="white" fill-opacity="0.28" text-anchor="middle" dy=".35em">${label}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * DestinationHeroImage
 * 
 * Uses React Query with long staleTime (1 hour) to avoid refetching.
 * The backend caches Google Places images in curated_images table for 90 days.
 * 
 * Flow:
 * 1. Check React Query cache (in-memory, instant)
 * 2. If miss, call backend which checks curated_images DB table (cached Google Places)
 * 3. If DB miss, backend fetches from Google Places and caches for 90 days
 * 4. Gradient fallback if all else fails
 */
export default function DestinationHeroImage({
  destinationId,
  destinationName,
  alt,
  className,
  overlayGradient = '',
}: DestinationHeroImageProps) {
  // useHeroImage has staleTime of 1 hour - won't refetch on every render
  // Backend checks curated_images table first (90-day cache of Google Places images)
  const { data, isLoading } = useHeroImage(destinationId, destinationName);

  const fallback = useMemo(() => generateGradientDataUrl(destinationName), [destinationName]);
  
  // Use cached/fetched image, or gradient fallback
  const src = data?.url || fallback;

  return (
    <HeroImageWithFallback
      src={src}
      alt={alt || destinationName}
      className={className}
      overlayGradient={overlayGradient}
    />
  );
}
