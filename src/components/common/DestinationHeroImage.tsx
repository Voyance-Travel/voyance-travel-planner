import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import HeroImageWithFallback from '@/components/common/HeroImageWithFallback';
import { useHeroImage } from '@/services/destinationImagesAPI';
import { getDestinationImages, hasCuratedImages } from '@/utils/destinationImages';

interface DestinationHeroImageProps {
  destinationId?: string;
  destinationName: string;
  alt?: string;
  className?: string;
  /**
   * Pass "" to disable overlay (most callers already render their own overlay)
   */
  overlayGradient?: string;
  /** Skip lazy loading – fetch immediately (e.g. above-the-fold hero) */
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
 * DestinationHeroImage
 * 
 * LAZY by default: the useHeroImage API call only fires once the component
 * scrolls into view (200px margin). This prevents dozens of edge-function
 * invocations on pages like Browse/Explore where many cards are off-screen.
 * 
 * Flow:
 * 1. Render gradient placeholder immediately
 * 2. When visible (IntersectionObserver), check curated images first
 * 3. If no curated image, fire useHeroImage (React Query → edge function)
 * 4. Edge function checks DB cache (90-day Google Places cache)
 * 5. Gradient fallback if all else fails
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

  // Intersection Observer – triggers API fetch only when visible
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

  // Curated images (local, no API cost) – always check
  const curatedSrc = useMemo(() => {
    if (!destinationName) return null;
    if (!hasCuratedImages(destinationName)) return null;
    const first = getDestinationImages(destinationName, 1)[0];
    return first || null;
  }, [destinationName]);

  // Only call the API when in view AND no curated image exists
  const shouldFetchApi = isInView && !curatedSrc;

  const { data } = useHeroImage(
    shouldFetchApi ? destinationId : undefined,
    shouldFetchApi ? destinationName : undefined
  );

  const fallback = useMemo(() => generateGradientDataUrl(destinationName), [destinationName]);
  
  // Use curated local image first, then cached/fetched image, or gradient fallback
  const src = curatedSrc || data?.url || fallback;

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