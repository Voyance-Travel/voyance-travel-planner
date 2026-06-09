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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  getDestinationImage, 
  getDestinationImages as getCuratedImages,
  hasCuratedImages,
  generateDestinationGradient
} from '@/utils/destinationImages';
import { getHeroImageByName, getDestinationCanonicalImage } from '@/services/destinationImagesAPI';
import { supabase } from '@/integrations/supabase/client';
import { isUntrustedHeroUrl } from '@/lib/heroUrlPolicy';
import { detectCrossCityMention } from '@/lib/crossCityFilter';
import { isCrossCityHero } from '@/lib/heroCrossCityGuard';
import { DESTINATION_STORAGE_IMAGES } from '@/data/destinationStorageImages';

/**
 * Stable internal-storage fallback tier.
 *
 * Closes recurring "blank brown/tan gradient hero" pattern (Dublin/Copenhagen/
 * Barcelona). Root cause: the canonical resolver only checks URL trust by host,
 * not whether the storage object actually exists. When `destinations.hero_image_url`
 * points at a `site-images/photo-*` object that 404s, the chain fell straight
 * through to the gradient because downstream tiers were gated on
 * `!canonicalUrl`. We now (a) keep advancing past `canonicalFailed`, and (b)
 * carry a hand-curated internal storage map keyed by city slug as the last
 * trusted tier before API/gradient.
 */
function lookupStorageHero(destination: string): string | null {
  if (!destination) return null;
  const cityOnly = destination.split(',')[0].trim().toLowerCase();
  const slug = cityOnly.replace(/\s+/g, '-');
  const candidates = [cityOnly, slug, cityOnly.replace(/-/g, ' ')];
  for (const k of candidates) {
    const hit = DESTINATION_STORAGE_IMAGES[k];
    // Skip untrusted URLs (e.g. the legacy old-host storage map) so this tier
    // can't pin a stale/dead-host image; the resolver advances to the API tier.
    if (hit?.imageUrl && !isUntrustedHeroUrl(hit.imageUrl)) return hit.imageUrl;
  }
  return null;
}

/**
 * Shared predicate: a seeded hero URL we should treat as broken/unusable.
 * Delegates to the project-wide isUntrustedHeroUrl policy so the display
 * path and the persistence write-back can never disagree about what counts
 * as "good enough to keep".
 */
function isBrokenSeededUrl(url: string): boolean {
  return isUntrustedHeroUrl(url);
}

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
  /** Photo attribution (currently only populated for Unsplash-sourced API photos) */
  attribution?: {
    photographer: string;
    photographer_url?: string;
    source_url?: string;
    source: 'unsplash';
  };
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
  const [canonicalUrl, setCanonicalUrl] = useState<string | null>(null);
  const [canonicalFetched, setCanonicalFetched] = useState(false);
  const [canonicalFailed, setCanonicalFailed] = useState(false);
  const [dbCuratedUrl, setDbCuratedUrl] = useState<string | null>(null);
  const [dbCuratedFetched, setDbCuratedFetched] = useState(false);
  const [dbCuratedFailed, setDbCuratedFailed] = useState(false);
  const [apiImageUrl, setApiImageUrl] = useState<string | null>(null);
  const [apiFetched, setApiFetched] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const [apiAttribution, setApiAttribution] = useState<UseTripHeroImageResult['attribution']>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  // Cross-city guard (closes "Madrid photo on Barcelona trip"). We resolve the
  // photo-id → city hint asynchronously and treat the URL as broken if it
  // points at a different city than the trip's destination.
  const [seededCrossCity, setSeededCrossCity] = useState(false);
  const [canonicalCrossCity, setCanonicalCrossCity] = useState(false);

  useEffect(() => {
    if (!seededHeroUrl || !destination) { setSeededCrossCity(false); return; }
    let cancelled = false;
    isCrossCityHero(seededHeroUrl, destination).then((bad) => {
      if (cancelled) return;
      if (bad) {
        console.warn(
          `[useTripHeroImage] cross-city seeded hero blocked dest="${destination}" url=${seededHeroUrl}`,
        );
        setSeededCrossCity(true);
      }
    });
    return () => { cancelled = true; };
  }, [seededHeroUrl, destination]);

  useEffect(() => {
    if (!canonicalUrl || !destination) { setCanonicalCrossCity(false); return; }
    let cancelled = false;
    isCrossCityHero(canonicalUrl, destination).then((bad) => {
      if (cancelled) return;
      if (bad) {
        console.warn(
          `[useTripHeroImage] cross-city canonical hero blocked dest="${destination}" url=${canonicalUrl}`,
        );
        setCanonicalCrossCity(true);
      }
    });
    return () => { cancelled = true; };
  }, [canonicalUrl, destination]);

  const curatedImages = getCuratedImages(destination);
  const hasCurated = hasCuratedImages(destination);

  const [storageFailed, setStorageFailed] = useState(false);
  const storageUrl = useMemo(() => lookupStorageHero(destination), [destination]);

  // Fetch canonical destination hero image (shared across all views)
  useEffect(() => {
    const seededDone = !seededHeroUrl || seededFailed || seededCrossCity || isBrokenSeededUrl(seededHeroUrl);
    const shouldFetch = seededDone && !canonicalFetched;

    if (!shouldFetch || !destination) return;

    let cancelled = false;

    getDestinationCanonicalImage(destination)
      .then((url) => {
        if (cancelled) return;
        setCanonicalFetched(true);
        if (url && !isUntrustedHeroUrl(url)) setCanonicalUrl(url);
      })
      .catch(() => {
        if (!cancelled) setCanonicalFetched(true);
      });

    return () => { cancelled = true; };
  }, [destination, seededHeroUrl, seededFailed, seededCrossCity, canonicalFetched]);

  // Fetch DB curated image when canonical+curated+storage are exhausted
  useEffect(() => {
    const seededDone = !seededHeroUrl || seededFailed || seededCrossCity || isBrokenSeededUrl(seededHeroUrl);
    const canonicalDone = canonicalFetched && (!canonicalUrl || canonicalFailed || canonicalCrossCity);
    const storageDone = !storageUrl || storageFailed;
    const shouldFetch =
      seededDone &&
      canonicalDone &&
      !hasCurated &&
      storageDone &&
      !dbCuratedFetched;

    if (!shouldFetch) return;

    let cancelled = false;

    getDbCuratedUrl(destination)
      .then((url) => {
        if (cancelled) return;
        setDbCuratedFetched(true);
        if (url && !isUntrustedHeroUrl(url)) {
          setDbCuratedUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) setDbCuratedFetched(true);
      });

    return () => { cancelled = true; };
  }, [destination, seededHeroUrl, seededFailed, seededCrossCity, hasCurated, dbCuratedFetched, canonicalFetched, canonicalUrl, canonicalCrossCity, storageUrl, storageFailed]);

  // Fetch from API once all earlier tiers are exhausted
  useEffect(() => {
    const seededDone = !seededHeroUrl || seededFailed || seededCrossCity || isBrokenSeededUrl(seededHeroUrl);
    const canonicalDone = canonicalFetched && (!canonicalUrl || canonicalFailed || canonicalCrossCity);
    const storageDone = !storageUrl || storageFailed;
    const shouldFetch =
      seededDone &&
      canonicalDone &&
      !hasCurated &&
      storageDone &&
      dbCuratedFetched && !dbCuratedUrl &&
      !apiFetched;

    if (!shouldFetch || !destination) return;

    let cancelled = false;
    setIsLoading(true);

    getHeroImageByName(destination)
      .then((result) => {
        if (cancelled) return;
        setApiFetched(true);
        const xcity = result?.alt
          ? detectCrossCityMention(result.alt, destination)
          : null;
        if (result?.url && !isUntrustedHeroUrl(result.url) && !xcity) {
          setApiImageUrl(result.url);
          if (result.source === 'unsplash' && result.photographer) {
            setApiAttribution({
              photographer: result.photographer,
              photographer_url: result.photographer_url ?? undefined,
              source_url: result.source_url ?? undefined,
              source: 'unsplash',
            });
          }
        } else {
          if (xcity) {
            console.warn(
              `[useTripHeroImage] cross-city blocked dest="${destination}" alt="${result?.alt}" → "${xcity}"`,
            );
          }
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
  }, [destination, seededHeroUrl, seededFailed, seededCrossCity, hasCurated, dbCuratedFetched, dbCuratedUrl, apiFetched, canonicalFetched, canonicalUrl, canonicalFailed, canonicalCrossCity, storageUrl, storageFailed]);

  // Determine current image URL based on fallback chain
  const getImageUrl = (): { url: string; source: UseTripHeroImageResult['source'] } => {
    // 1. Seeded hero (if not failed AND not a known-broken URL)
    if (seededHeroUrl && !seededFailed) {
      if (isBrokenSeededUrl(seededHeroUrl)) {
        // Treat broken seeded URLs as failed; persistence path will overwrite.
      } else {
        return { url: seededHeroUrl, source: 'seeded' };
      }
    }

    // 2. Canonical destination hero (shared single source of truth)
    if (canonicalUrl && !canonicalFailed) {
      return { url: canonicalUrl, source: 'db_curated' };
    }

    // 3. Stable internal storage map (durable last-trusted tier;
    // closes Dublin/Copenhagen/Barcelona blank-hero regression when
    // canonical points at a missing storage object).
    if (storageUrl && !storageFailed) {
      return { url: storageUrl, source: 'db_curated' };
    }

    // 4. Curated images — pinned to [0], no rotation
    if (hasCurated && !curatedFailed && curatedImages[curatedIndex]) {
      return { url: curatedImages[curatedIndex], source: 'curated' };
    }

    // 4. DB curated image (admin-managed curated_images table)
    if (dbCuratedUrl && !dbCuratedFailed) {
      return { url: dbCuratedUrl, source: 'db_curated' };
    }

    // 5. API fetched image
    if (apiImageUrl && !apiFailed) {
      return { url: apiImageUrl, source: 'api' };
    }

    // 6. Gradient fallback
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
        const existingHero = typeof existing.hero_image === 'string' ? existing.hero_image : '';

        // Skip write only if stored value is good AND matches what we'd write.
        // Otherwise overwrite — covers: empty, broken-CDN seeded URLs, and stale
        // values that differ from a freshly-resolved canonical/db/api image.
        const storedIsGood = existingHero && !isBrokenSeededUrl(existingHero);
        if (storedIsGood && existingHero === imageUrl) return;

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

    // Handle canonical image failure
    if (canonicalUrl && !canonicalFailed) {
      console.warn('[useTripHeroImage] canonical failed, advancing to next tier:', canonicalUrl);
      setCanonicalFailed(true);
      return;
    }

    // Handle storage-map image failure
    if (storageUrl && !storageFailed) {
      console.warn('[useTripHeroImage] storage hero failed, advancing to next tier:', storageUrl);
      setStorageFailed(true);
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
    canonicalUrl,
    canonicalFailed,
    hasCurated, 
    curatedFailed, 
    curatedIndex, 
    curatedImages.length,
    dbCuratedUrl,
    dbCuratedFailed,
    apiImageUrl,
    apiFailed,
    storageUrl,
    storageFailed,
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
    // Only surface attribution when the active source is the API fetch (Unsplash)
    attribution: source === 'api' && !apiFailed ? apiAttribution : undefined,
  };
}
