/**
 * useTripHeroImage - Smart hero image hook for trips
 * 
 * Priority chain:
 * 1. Trip metadata hero_image (seeded/user-uploaded)
 * 2. Curated destination images (fast, local)
 * 3. DB curated images (admin-managed via curated_images table)
 * 4. API fetch via destination-images edge function (Google Places, etc.)
 * 5. Gradient fallback (deterministic, always works)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getDestinationImage, 
  getDestinationImages as getCuratedImages,
  hasCuratedImages,
  generateDestinationGradient
} from '@/utils/destinationImages';
import { getHeroImageByName } from '@/services/destinationImagesAPI';
import { supabase } from '@/integrations/supabase/client';

interface UseTripHeroImageOptions {
  destination: string;
  seededHeroUrl?: string | null;
  tripId?: string;
}

interface UseTripHeroImageResult {
  imageUrl: string;
  isLoading: boolean;
  source: 'seeded' | 'curated' | 'db_curated' | 'api' | 'gradient';
  onError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  /** 
   * Handler to validate image dimensions after load
   * Detects blank/tiny images that load successfully but contain no content
   */
  onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Fetch hero image URL from the curated_images DB table (admin-managed).
 */
async function getDbCuratedUrl(destination: string): Promise<string | null> {
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

export function useTripHeroImage({
  destination,
  seededHeroUrl,
  tripId,
}: UseTripHeroImageOptions): UseTripHeroImageResult {
  const [seededFailed, setSeededFailed] = useState(false);
  const [curatedIndex, setCuratedIndex] = useState(0);
  const [curatedFailed, setCuratedFailed] = useState(false);
  const [dbCuratedUrl, setDbCuratedUrl] = useState<string | null>(null);
  const [dbCuratedFetched, setDbCuratedFetched] = useState(false);
  const [dbCuratedFailed, setDbCuratedFailed] = useState(false);
  const [apiImageUrl, setApiImageUrl] = useState<string | null>(null);
  const [apiFetched, setApiFetched] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const curatedImages = getCuratedImages(destination);
  const hasCurated = hasCuratedImages(destination);

  // Fetch DB curated image if hardcoded curated not available
  useEffect(() => {
    const shouldFetch = 
      (!seededHeroUrl || seededFailed) && 
      !hasCurated && 
      !dbCuratedFetched;

    if (!shouldFetch) return;

    let cancelled = false;

    getDbCuratedUrl(destination)
      .then((url) => {
        if (cancelled) return;
        setDbCuratedFetched(true);
        if (url) {
          setDbCuratedUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) setDbCuratedFetched(true);
      });

    return () => { cancelled = true; };
  }, [destination, seededHeroUrl, seededFailed, hasCurated, dbCuratedFetched]);

  // Fetch from API if DB curated images aren't available either
  useEffect(() => {
    const shouldFetch = 
      (!seededHeroUrl || seededFailed) && 
      !hasCurated && 
      dbCuratedFetched && !dbCuratedUrl &&
      !apiFetched;

    if (!shouldFetch || !destination) return;

    let cancelled = false;
    setIsLoading(true);

    getHeroImageByName(destination)
      .then((result) => {
        if (cancelled) return;
        setApiFetched(true);
        if (result?.url) {
          setApiImageUrl(result.url);
        } else {
          setApiFailed(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setApiFetched(true);
        setApiFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destination, seededHeroUrl, seededFailed, hasCurated, dbCuratedFetched, dbCuratedUrl, apiFetched]);

  // Determine current image URL based on fallback chain
  const getImageUrl = (): { url: string; source: UseTripHeroImageResult['source'] } => {
    // 1. Seeded hero (if not failed AND not a known-broken Unsplash URL)
    if (seededHeroUrl && !seededFailed) {
      // Treat dead Unsplash URLs as failed so we skip straight to curated/API
      if (/images\.unsplash\.com/.test(seededHeroUrl)) {
        // Unsplash CDN URLs break silently — treat seeded as failed
      } else {
        return { url: seededHeroUrl, source: 'seeded' };
      }
    }

    // 2. Curated images (if available and not all failed)
    if (hasCurated && !curatedFailed && curatedImages[curatedIndex]) {
      return { url: curatedImages[curatedIndex], source: 'curated' };
    }

    // 3. DB curated image (admin-managed)
    if (dbCuratedUrl && !dbCuratedFailed) {
      return { url: dbCuratedUrl, source: 'db_curated' };
    }

    // 4. API fetched image
    if (apiImageUrl && !apiFailed) {
      return { url: apiImageUrl, source: 'api' };
    }

    // 5. Gradient fallback
    return { 
      url: generateDestinationGradient(tripId || destination), 
      source: 'gradient' 
    };
  };

  const { url: imageUrl, source } = getImageUrl();

  // Write-back: persist resolved hero URL to trip metadata so it's stable on future visits
  const persistedRef = useRef(false);
  useEffect(() => {
    if (
      persistedRef.current ||
      !tripId ||
      !imageUrl ||
      source === 'seeded' ||
      source === 'gradient' ||
      imageUrl.startsWith('data:')
    ) return;

    persistedRef.current = true;

    // Fire-and-forget: merge hero_image into existing metadata JSONB
    (async () => {
      try {
        const { data } = await supabase
          .from('trips')
          .select('metadata')
          .eq('id', tripId)
          .single();

        const existing = (data?.metadata as Record<string, unknown>) || {};
        // Don't overwrite if already set
        if (existing.hero_image) return;

        await supabase
          .from('trips')
          .update({ metadata: { ...existing, hero_image: imageUrl } } as any)
          .eq('id', tripId);
      } catch {
        // Non-critical, silently ignore
      }
    })();
  }, [tripId, imageUrl, source]);
  const handleFallback = useCallback(() => {
    // Handle seeded image failure
    if (seededHeroUrl && !seededFailed) {
      setSeededFailed(true);
      return;
    }

    // Handle curated image failure - try next in list
    if (hasCurated && !curatedFailed) {
      if (curatedIndex < curatedImages.length - 1) {
        setCuratedIndex(prev => prev + 1);
      } else {
        setCuratedFailed(true);
      }
      return;
    }

    // Handle DB curated image failure
    if (dbCuratedUrl && !dbCuratedFailed) {
      setDbCuratedFailed(true);
      return;
    }

    // Handle API image failure
    if (apiImageUrl && !apiFailed) {
      setApiFailed(true);
      return;
    }
  }, [
    seededHeroUrl, 
    seededFailed, 
    hasCurated, 
    curatedFailed, 
    curatedIndex, 
    curatedImages.length,
    dbCuratedUrl,
    dbCuratedFailed,
    apiImageUrl,
    apiFailed,
  ]);

  const onError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    handleFallback();

    // All sources failed - gradient fallback is always safe
    const img = e.currentTarget;
    if (!img.src.startsWith('data:')) {
      img.src = generateDestinationGradient(tripId || destination);
    }
  }, [handleFallback, tripId, destination]);

  /**
   * Validate image dimensions after load
   * Detects blank/tiny images that return HTTP 200 but contain no useful content
   */
  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    
    if (img.naturalWidth < 10 || img.naturalHeight < 10) {
      console.warn('[useTripHeroImage] Loaded but blank/tiny, triggering fallback:', imageUrl);
      handleFallback();
      img.src = generateDestinationGradient(tripId || destination);
    }
  }, [imageUrl, handleFallback, tripId, destination]);

  return {
    imageUrl,
    isLoading,
    source,
    onError,
    onLoad,
  };
}
