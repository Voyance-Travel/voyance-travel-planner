/**
 * Hook for fetching activity photos using tiered real photo sources
 * Priority: Cache → Google Places → TripAdvisor → Wikimedia → AI (last resort)
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Simple in-memory cache to avoid refetching
const imageCache = new Map<string, { url: string; source: string }>();

// Pending requests to dedupe concurrent fetches
const pendingRequests = new Map<string, Promise<{ url: string; source: string } | null>>();

function generateCategoryGradient(category: string): string {
  const seed = (category || 'activity').toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 36) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${hue1},60%,42%)"/>
        <stop offset="100%" style="stop-color:hsl(${hue2},58%,32%)"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function getCategoryFallback(category?: string): string {
  return generateCategoryGradient(category || 'activity');
}

function getCacheKey(title: string, destination?: string, cacheId?: string): string {
  const normalized = `${cacheId || title}-${destination || 'unknown'}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 80);
  return normalized;
}

async function fetchImageFromBackend(
  title: string,
  category: string,
  destination: string
): Promise<{ url: string; source: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('destination-images', {
      body: {
        venueName: title,
        destination: destination,
        category: category,
        imageType: 'activity',
      },
    });

    if (error) {
      // Backend error - fall through to fallback handling
      return null;
    }

    const image = data?.images?.[0];
    if (image?.url && image.source !== 'fallback') {
      return { url: image.url, source: image.source };
    }

    return null;
  } catch (err) {
    // Fetch error - fall through to fallback handling
    return null;
  }
}

export function useActivityImage(
  title: string,
  category?: string,
  existingPhoto?: string | null,
  destination?: string,
  cacheId?: string
): { 
  imageUrl: string | null; 
  loading: boolean; 
  source: string | null;
} {
  const [imageUrl, setImageUrl] = useState<string | null>(existingPhoto || null);
  const [loading, setLoading] = useState(!existingPhoto);
  const [source, setSource] = useState<string | null>(existingPhoto ? 'existing' : null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // If we have an existing photo from the backend, use it
    if (existingPhoto) {
      setImageUrl(existingPhoto);
      setSource('existing');
      setLoading(false);
      return;
    }

    // Skip fetching for transport/downtime only - accommodation can now fetch hotel images
    const skipCategories = ['transport', 'transportation', 'downtime', 'free_time'];
    if (skipCategories.includes(category?.toLowerCase() || '')) {
      setImageUrl(getCategoryFallback(category));
      setSource('fallback');
      setLoading(false);
      return;
    }

    const cacheKey = getCacheKey(title, destination, cacheId);

    // Check in-memory cache first
    if (imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey)!;
      setImageUrl(cached.url);
      setSource(cached.source);
      setLoading(false);
      return;
    }

    // Check if there's already a pending request for this image
    if (pendingRequests.has(cacheKey)) {
      pendingRequests.get(cacheKey)!.then((result) => {
        if (mountedRef.current) {
          if (result) {
            setImageUrl(result.url);
            setSource(result.source);
          } else {
            setImageUrl(getCategoryFallback(category));
            setSource('fallback');
          }
          setLoading(false);
        }
      });
      return;
    }

    // If destination is missing, don't attempt "real" venue lookup.
    // Without destination we get wildly irrelevant results and cache collisions.
    if (!destination || destination.trim().length < 2) {
      setImageUrl(getCategoryFallback(category));
      setSource('fallback');
      setLoading(false);
      return;
    }

    // Set loading state with category fallback as placeholder
    setImageUrl(getCategoryFallback(category));
    setLoading(true);

    // Create the fetch promise
    const fetchPromise = fetchImageFromBackend(
      title,
      category || 'activity',
      destination
    );

    pendingRequests.set(cacheKey, fetchPromise);

    // Debounce slightly to batch rapid requests
    const timer = setTimeout(() => {
      fetchPromise.then((result) => {
        pendingRequests.delete(cacheKey);
        
        if (!mountedRef.current) return;

        if (result) {
          imageCache.set(cacheKey, result);
          setImageUrl(result.url);
          setSource(result.source);
        } else {
          // Keep the category fallback
          setSource('fallback');
        }
        setLoading(false);
      });
    }, 50 + Math.random() * 100);

    return () => clearTimeout(timer);
  }, [title, category, existingPhoto, destination]);

  return { imageUrl, loading, source };
}

// Pre-get a placeholder URL based on category (no API call, instant)
export function getActivityPlaceholder(category?: string): string {
  return getCategoryFallback(category);
}

// Clear the image cache (useful for testing or forced refresh)
export function clearActivityImageCache(): void {
  imageCache.clear();
  pendingRequests.clear();
}
