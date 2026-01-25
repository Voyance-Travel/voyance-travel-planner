/**
 * Hook to fetch 2 distinct destination images for hero and mid-page sections.
 * Fetches once per destination and provides both images to avoid multiple API calls.
 */

import { useState, useEffect, useMemo } from 'react';
import { getDestinationImages } from '@/services/destinationImagesAPI';

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
        // Fetch 2 images at once
        const images = await getDestinationImages({
          destination: queryDestination,
          imageType: 'gallery',
          limit: 2,
        });

        if (cancelled) return;

        if (images.length >= 2) {
          setHeroImage(images[0].url);
          setMidImage(images[1].url);
        } else if (images.length === 1) {
          // Only 1 image available - use it for hero, gradient for mid
          setHeroImage(images[0].url);
          setMidImage(generateGradientDataUrl(cleanDestination));
        } else {
          // No images - use gradients for both
          setHeroImage(generateGradientDataUrl(cleanDestination));
          setMidImage(generateGradientDataUrl(cleanDestination));
        }
      } catch (err) {
        console.error('[useDestinationImages] Failed to fetch images:', err);
        if (!cancelled) {
          setHeroImage(generateGradientDataUrl(cleanDestination));
          setMidImage(generateGradientDataUrl(cleanDestination));
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
