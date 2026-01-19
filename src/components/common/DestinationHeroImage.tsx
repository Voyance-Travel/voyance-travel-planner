import { useMemo } from 'react';
import HeroImageWithFallback from '@/components/common/HeroImageWithFallback';
import { useHeroImage } from '@/services/destinationImagesAPI';
import { getDestinationImage, hasCuratedImages } from '@/utils/destinationImages';

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

  // btoa is available in the browser
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Extract city name from destination string (e.g., "Paris, France" -> "paris")
 */
function extractCityKey(destinationName: string): string {
  // Handle "City, Country" format
  const city = destinationName.split(',')[0].trim().toLowerCase();
  // Handle slug format (e.g., "new-york")
  return city.replace(/\s+/g, '-');
}

export default function DestinationHeroImage({
  destinationId,
  destinationName,
  alt,
  className,
  overlayGradient = '',
}: DestinationHeroImageProps) {
  // First check if we have curated images - these are instant, no API call needed
  const cityKey = extractCityKey(destinationName);
  const hasCurated = hasCuratedImages(cityKey);
  
  // Only call the API if we don't have curated images
  const { data } = useHeroImage(
    hasCurated ? undefined : destinationId, 
    hasCurated ? undefined : destinationName
  );

  const src = useMemo(() => {
    // Priority 1: Curated static images (instant, no API call)
    if (hasCurated) {
      return getDestinationImage(cityKey);
    }
    
    // Priority 2: API-fetched image
    if (data?.url) {
      return data.url;
    }
    
    // Priority 3: Gradient fallback
    return generateGradientDataUrl(destinationName);
  }, [hasCurated, cityKey, data?.url, destinationName]);

  return (
    <HeroImageWithFallback
      src={src}
      alt={alt || destinationName}
      className={className}
      overlayGradient={overlayGradient}
    />
  );
}
