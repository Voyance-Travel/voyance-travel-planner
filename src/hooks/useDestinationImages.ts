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

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickTwoDistinct(
  urls: string[],
  fallbackLabel: string,
  seed: string
): { hero: string; mid: string } {
  const unique = Array.from(new Set(urls.filter(Boolean)));

  if (unique.length === 0) {
    return {
      hero: generateGradientDataUrl(fallbackLabel, 0),
      mid: generateGradientDataUrl(fallbackLabel, 1),
    };
  }

  if (unique.length === 1) {
    return {
      hero: unique[0],
      mid: generateGradientDataUrl(fallbackLabel, 1),
    };
  }

  const h = hashString(seed);
  const heroIndex = h % unique.length;

  // Choose a different index than heroIndex, but deterministically.
  // Offset in range [1, unique.length - 1]
  const offset = (h % (unique.length - 1)) + 1;
  const midIndex = (heroIndex + offset) % unique.length;

  return { hero: unique[heroIndex], mid: unique[midIndex] };
}

export function useDestinationImages(
  destination: string,
  destinationCountry?: string,
  seedKey?: string
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
          // Pull a larger set so we can avoid repeats deterministically.
          const curatedUrls = getCuratedImages(cleanDestination, 8);
          const chosen = pickTwoDistinct(
            curatedUrls,
            cleanDestination,
            seedKey || `${cleanDestination}|curated`
          );

          if (!cancelled) {
            setHeroImage(chosen.hero);
            setMidImage(chosen.mid);
            setIsLoading(false);
          }
          return;
        }

        // Fallback to API for non-curated destinations
        const images = await getAPIImages({
          destination: queryDestination,
          imageType: 'gallery',
          // Fetch more so we can reliably pick a different mid image
          limit: 6,
        });

        if (cancelled) return;

        const chosen = pickTwoDistinct(
          images.map(i => i.url),
          cleanDestination,
          seedKey || `${queryDestination}|api`
        );

        setHeroImage(chosen.hero);
        setMidImage(chosen.mid);
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
  }, [cleanDestination, queryDestination, seedKey]);

  return { heroImage, midImage, isLoading };
}
