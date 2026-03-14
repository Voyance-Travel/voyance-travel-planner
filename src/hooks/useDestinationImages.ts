/**
 * Hook to fetch a single destination hero image.
 * The mid-page "second image" was removed to cut costs and fix consistency issues.
 *
 * Priority chain:
 * 1. Hardcoded curated images (instant, no network)
 * 2. DB curated images (admin-managed via curated_images table)
 * 3. API fetch via edge function (Google Places, etc.)
 * 4. Gradient fallback
 */

import { useState, useEffect, useMemo } from 'react';
import { getDestinationImages as getCuratedImages, hasCuratedImages } from '@/utils/destinationImages';
import { getDestinationImages as getAPIImages } from '@/services/destinationImagesAPI';
import { supabase } from '@/integrations/supabase/client';

interface DestinationImagesResult {
  heroImage: string | null;
  /** @deprecated midImage has been removed — always returns null */
  midImage: string | null;
  isLoading: boolean;
}

function normalizeDestination(dest: string): string {
  return (dest || '')
    .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
    .replace(/\b(international\s+)?airport\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();
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

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof Image !== 'undefined';
}

// Known-broken Unsplash photo IDs that return 404
const BLOCKED_IMAGE_IDS = new Set([
  'photo-1563177978-4f4a11e3f462',
  'photo-1579606032821-4e6161c81571',
  'photo-1469854523086-cc02fe5d8800',
  'photo-1613395877344-13d4a8e0d49e',
  'photo-1513635269975-59663e0ac1ad',
  'photo-1512635269975-5963e0ac1ad',
  'photo-1596768651008-c3d3ef56c8cf',
  'photo-1623083500086-8a7cd5a8f4a6',
]);

function isBlockedUrl(url: string): boolean {
  if (!url) return false;
  return [...BLOCKED_IMAGE_IDS].some(id => url.includes(id));
}

async function isUrlLoadable(url: string, timeoutMs: number = 4500): Promise<boolean> {
  if (!url) return false;
  if (isBlockedUrl(url)) return false;
  if (url.startsWith('data:')) return true;
  if (!isBrowser()) return true;

  return await new Promise<boolean>((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (ok: boolean) => { if (done) return; done = true; resolve(ok); };
    const t = window.setTimeout(() => finish(false), timeoutMs);
    img.onload = () => { window.clearTimeout(t); finish(true); };
    img.onerror = () => { window.clearTimeout(t); finish(false); };
    img.src = url;
  });
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function rotateDeterministic<T>(arr: T[], seed: string): T[] {
  if (arr.length <= 1) return arr;
  const start = hashString(seed) % arr.length;
  return [...arr.slice(start), ...arr.slice(0, start)];
}

/**
 * Fetch hero image URLs from the curated_images DB table (admin-managed).
 * Returns null if no results found.
 */
async function getDbCuratedHeroUrl(destination: string): Promise<string | null> {
  try {
    const normalizedKey = destination.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').slice(0, 100);
    const { data, error } = await supabase
      .from('curated_images')
      .select('image_url')
      .eq('entity_type', 'destination')
      .eq('entity_key', normalizedKey)
      .eq('is_blacklisted', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('vote_score', { ascending: false, nullsFirst: false })
      .order('quality_score', { ascending: false, nullsFirst: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return (data[0] as any).image_url || null;
  } catch {
    return null;
  }
}

export function useDestinationImages(
  destination: string,
  destinationCountry?: string,
  seedKey?: string
): DestinationImagesResult {
  const [heroImage, setHeroImage] = useState<string | null>(null);
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
        const seed = seedKey || `${queryDestination}|default`;

        // TIER 1: Hardcoded curated images (instant, no network)
        if (hasCuratedImages(cleanDestination)) {
          const curatedUrls = getCuratedImages(cleanDestination, 4);
          const ordered = rotateDeterministic(curatedUrls, seed);
          
          for (const u of ordered) {
            if (await isUrlLoadable(u)) {
              if (!cancelled) setHeroImage(u);
              return;
            }
          }
          // All curated failed — fall through to DB
        }

        // TIER 2: DB curated images (admin-managed via curated_images table)
        const dbUrl = await getDbCuratedHeroUrl(cleanDestination);
        if (dbUrl && !cancelled) {
          if (await isUrlLoadable(dbUrl)) {
            setHeroImage(dbUrl);
            return;
          }
        }

        // TIER 3: API fetch (Google Places via edge function)
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
      } catch (err) {
        console.error('[useDestinationImages] Failed to fetch images:', err);
        if (!cancelled) {
          setHeroImage(generateGradientDataUrl(cleanDestination, 0));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchImages();
    return () => { cancelled = true; };
  }, [cleanDestination, queryDestination, seedKey]);

  // midImage kept as null for backward compatibility
  return { heroImage, midImage: null, isLoading };
}
