import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import HeroImageWithFallback from '@/components/common/HeroImageWithFallback';
import { useHeroImage, getDestinationCanonicalImage, writeBackDestinationCanonicalImage } from '@/services/destinationImagesAPI';
import { getDestinationImage, hasCuratedImages } from '@/utils/destinationImages';
import { useQuery } from '@tanstack/react-query';

interface DestinationHeroImageProps {
  destinationId?: string;
  destinationName: string;
  alt?: string;
  className?: string;
  overlayGradient?: string;
  eager?: boolean;
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
 * DestinationHeroImage — ONE canonical image per destination, consistent everywhere.
 *
 * Priority:
 * 1. destinations.hero_image_url (DB canonical — single source of truth)
 * 2. Curated local image [0] (pinned, no rotation)
 * 3. Edge function (Google Places) — write-back to DB on resolve
 * 4. Gradient fallback
 */
export default function DestinationHeroImage({
  destinationId,
  destinationName,
  alt,
  className,
  overlayGradient = '',
  eager = false,
}: DestinationHeroImageProps) {
  const [isInView, setIsInView] = useState(eager);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer — lazy loading
  useEffect(() => {
    if (eager || isInView) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, isInView]);

  // TIER 1: DB canonical image (shared across all views/users)
  const { data: canonicalUrl } = useQuery({
    queryKey: ['destination-canonical-hero', destinationName],
    queryFn: () => getDestinationCanonicalImage(destinationName),
    enabled: isInView && !!destinationName,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // TIER 2: Curated local image — always pinned to [0], no rotation
  const curatedSrc = useMemo(() => {
    if (!destinationName) return null;
    if (!hasCuratedImages(destinationName)) return null;
    return getDestinationImage(destinationName); // always returns [0]
  }, [destinationName]);

  // TIER 3: Edge function (only if no canonical and no curated)
  const shouldFetchApi = isInView && !canonicalUrl && !curatedSrc;
  const { data: apiData } = useHeroImage(
    shouldFetchApi ? destinationId : undefined,
    shouldFetchApi ? destinationName : undefined
  );

  // Write-back: persist resolved API image to destinations.hero_image_url
  const writtenBackRef = useRef(false);
  useEffect(() => {
    if (writtenBackRef.current) return;
    if (apiData?.url && !canonicalUrl) {
      writtenBackRef.current = true;
      writeBackDestinationCanonicalImage(destinationName, apiData.url);
    }
  }, [apiData?.url, canonicalUrl, destinationName]);

  const fallback = useMemo(() => generateGradientDataUrl(destinationName), [destinationName]);

  // Final image: canonical DB > curated [0] > API resolved > gradient
  const src = canonicalUrl || curatedSrc || apiData?.url || fallback;

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      <HeroImageWithFallback
        src={src}
        alt={alt || destinationName}
        className={className}
        overlayGradient={overlayGradient}
      />
    </div>
  );
}
