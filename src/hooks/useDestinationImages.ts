/**
 * Hook to fetch 2 distinct destination images for hero and mid-page sections.
 * Uses curated images directly for reliability.
 */

import { useState, useEffect, useMemo } from 'react';
import { getDestinationImages as getCuratedImages, hasCuratedImages } from '@/utils/destinationImages';
import { getDestinationImages as getAPIImages } from '@/services/destinationImagesAPI';

interface DestinationImagesResult {
  heroImage: string | null;
  midImage: string | null;
  isLoading: boolean;
}

// Helper to normalize destination strings (remove IATA codes like "(FCO)")
function normalizeDestination(dest: string): string {
  return (dest || '')
    .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
    .replace(/\b(international\s+)?airport\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function generateGradientDataUrl(label: string, variant: number = 0): string {
  let hash = variant;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40 + variant * 30) % 360;

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

export function useDestinationImages(
  destination: string,
  destinationCountry?: string
): DestinationImagesResult {
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [midImage, setMidImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const cleanDestination = useMemo(() => normalizeDestination(destination), [destination]);
  const queryDestination = useMemo(
    () => (destinationCountry ? `${cleanDestination}, ${destinationCountry}` : cleanDestination),
    [cleanDestination, destinationCountry]
  );

  useEffect(() => {
    if (!cleanDestination) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchImages() {
      setIsLoading(true);
      try {
        // First, try to use curated images directly (faster and more reliable)
        if (hasCuratedImages(cleanDestination)) {
          const curatedUrls = getCuratedImages(cleanDestination, 2);
          console.log('[useDestinationImages] Using curated images:', curatedUrls);
          
          if (!cancelled && curatedUrls.length >= 2) {
            // Ensure they're different
            if (curatedUrls[0] !== curatedUrls[1]) {
              setHeroImage(curatedUrls[0]);
              setMidImage(curatedUrls[1]);
            } else {
              setHeroImage(curatedUrls[0]);
              setMidImage(generateGradientDataUrl(cleanDestination, 1));
            }
            setIsLoading(false);
            return;
          }
        }

        // Fallback to API for non-curated destinations
        const images = await getAPIImages({
          destination: queryDestination,
          imageType: 'gallery',
          limit: 2,
        });

        console.log('[useDestinationImages] API returned:', images.map(i => i.url));

        if (cancelled) return;

        if (images.length >= 2) {
          // Ensure we have 2 DIFFERENT images
          const url1 = images[0].url;
          const url2 = images[1].url !== url1 ? images[1].url : generateGradientDataUrl(cleanDestination, 1);
          setHeroImage(url1);
          setMidImage(url2);
        } else if (images.length === 1) {
          setHeroImage(images[0].url);
          setMidImage(generateGradientDataUrl(cleanDestination, 1));
        } else {
          setHeroImage(generateGradientDataUrl(cleanDestination, 0));
          setMidImage(generateGradientDataUrl(cleanDestination, 1));
        }
      } catch (err) {
        console.error('[useDestinationImages] Failed to fetch images:', err);
        if (!cancelled) {
          setHeroImage(generateGradientDataUrl(cleanDestination, 0));
          setMidImage(generateGradientDataUrl(cleanDestination, 1));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchImages();

    return () => {
      cancelled = true;
    };
  }, [cleanDestination, queryDestination]);

  return { heroImage, midImage, isLoading };
}
