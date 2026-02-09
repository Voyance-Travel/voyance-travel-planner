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
    .trim()
    .toLowerCase(); // Ensure lowercase for curated image lookup
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

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof Image !== 'undefined';
}

async function isUrlLoadable(url: string, timeoutMs: number = 4500): Promise<boolean> {
  if (!url) return false;
  // data: URLs always "load" for our purposes
  if (url.startsWith('data:')) return true;

  // During SSR/tests without DOM, don't block the UI; assume loadable.
  if (!isBrowser()) return true;

  return await new Promise<boolean>((resolve) => {
    const img = new Image();
    let done = false;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
    };

    const t = window.setTimeout(() => finish(false), timeoutMs);
    img.onload = () => {
      window.clearTimeout(t);
      finish(true);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      finish(false);
    };
    img.src = url;
  });
}

function rotateDeterministic<T>(arr: T[], seed: string): T[] {
  if (arr.length <= 1) return arr;
  const start = hashString(seed) % arr.length;
  return [...arr.slice(start), ...arr.slice(0, start)];
}

async function pickTwoLoadableDistinct(
  urls: string[],
  fallbackLabel: string,
  seed: string
): Promise<{ hero: string; mid: string }> {
  const unique = Array.from(new Set(urls.filter(Boolean)));

  if (unique.length === 0) {
    return {
      hero: generateGradientDataUrl(fallbackLabel, 0),
      mid: generateGradientDataUrl(fallbackLabel, 1),
    };
  }

  const ordered = rotateDeterministic(unique, seed);

  let hero: string | null = null;
  for (const u of ordered) {
    // eslint-disable-next-line no-await-in-loop
    if (await isUrlLoadable(u)) {
      hero = u;
      break;
    }
  }

  if (!hero) {
    return {
      hero: generateGradientDataUrl(fallbackLabel, 0),
      mid: generateGradientDataUrl(fallbackLabel, 1),
    };
  }

  // Pick a different, loadable mid image.
  for (const u of ordered) {
    if (u === hero) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await isUrlLoadable(u)) {
      return { hero, mid: u };
    }
  }

  // Return null for mid so caller can fetch landmark fallback
  return { hero, mid: null as unknown as string };
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

    // Helper: get a second distinct image, preferring curated over unreliable API
    // The API landmark fallback was returning random/irrelevant images, so we now
    // skip it entirely and use a styled gradient as the mid-page accent instead.
    function getMidFallback(): string {
      return generateGradientDataUrl(cleanDestination, 1);
    }

    async function fetchImages() {
      setIsLoading(true);
      try {
        const seed = seedKey || `${queryDestination}|default`;

        // First, try to use curated images directly (faster and more reliable)
        if (hasCuratedImages(cleanDestination)) {
          // Pull a larger set so we can avoid repeats deterministically.
          const curatedUrls = getCuratedImages(cleanDestination, 8);
          const chosen = await pickTwoLoadableDistinct(
            curatedUrls,
            cleanDestination,
            `${seed}|curated`
          );

          let mid = chosen.mid;
          if (!mid && chosen.hero) {
            mid = getMidFallback();
          }

          if (!cancelled) {
            setHeroImage(chosen.hero);
            setMidImage(mid);
            setIsLoading(false);
          }
          return;
        }

        // For non-curated destinations, use a single API image for hero
        // and a gradient for mid — the API's second image is often random/irrelevant
        const images = await getAPIImages({
          destination: queryDestination,
          imageType: 'hero',
          limit: 1,
        });

        if (cancelled) return;

        const heroUrl = images[0]?.url && (await isUrlLoadable(images[0].url))
          ? images[0].url
          : generateGradientDataUrl(cleanDestination, 0);

        setHeroImage(heroUrl);
        setMidImage(generateGradientDataUrl(cleanDestination, 1));
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
