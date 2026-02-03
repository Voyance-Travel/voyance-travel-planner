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

// Category-based static fallbacks (used while loading or if all sources fail)
const CATEGORY_FALLBACKS: Record<string, string> = {
  breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=300&fit=crop',
  brunch: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop',
  lunch: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
  dinner: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
  dining: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop',
  cafe: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
  coffee: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
  museum: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=400&h=300&fit=crop',
  cultural: 'https://images.unsplash.com/photo-1569974498991-d3c12a504f95?w=400&h=300&fit=crop',
  sightseeing: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop',
  tour: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=300&fit=crop',
  activity: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400&h=300&fit=crop',
  adventure: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=300&fit=crop',
  spa: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop', // Face mask spa treatment
  relaxation: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop', // Massage/spa
  recharge: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop', // Face mask
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop',
  shopping: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400&h=300&fit=crop',
  entertainment: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=300&fit=crop',
  nightlife: 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=400&h=300&fit=crop',
  transport: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=300&fit=crop',
  accommodation: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop',
};

function getCacheKey(title: string, destination?: string, cacheId?: string): string {
  const normalized = `${cacheId || title}-${destination || 'unknown'}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 80);
  return normalized;
}

function getCategoryFallback(category?: string): string {
  const cat = (category || 'activity').toLowerCase();
  return CATEGORY_FALLBACKS[cat] || CATEGORY_FALLBACKS.activity;
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
