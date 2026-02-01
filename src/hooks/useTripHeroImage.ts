/**
 * useTripHeroImage - Smart hero image hook for trips
 * 
 * Priority chain:
 * 1. Trip metadata hero_image (seeded/user-uploaded)
 * 2. Curated destination images (fast, local)
 * 3. API fetch via destination-images edge function (Google Places, etc.)
 * 4. Gradient fallback (deterministic, always works)
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getDestinationImage, 
  getDestinationImages as getCuratedImages,
  hasCuratedImages,
  generateDestinationGradient
} from '@/utils/destinationImages';
import { getHeroImageByName } from '@/services/destinationImagesAPI';

interface UseTripHeroImageOptions {
  destination: string;
  seededHeroUrl?: string | null;
  tripId?: string;
}

interface UseTripHeroImageResult {
  imageUrl: string;
  isLoading: boolean;
  source: 'seeded' | 'curated' | 'api' | 'gradient';
  onError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

export function useTripHeroImage({
  destination,
  seededHeroUrl,
  tripId,
}: UseTripHeroImageOptions): UseTripHeroImageResult {
  const [seededFailed, setSeededFailed] = useState(false);
  const [curatedIndex, setCuratedIndex] = useState(0);
  const [curatedFailed, setCuratedFailed] = useState(false);
  const [apiImageUrl, setApiImageUrl] = useState<string | null>(null);
  const [apiFetched, setApiFetched] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const curatedImages = getCuratedImages(destination);
  const hasCurated = hasCuratedImages(destination);

  // Fetch from API if curated images aren't available
  useEffect(() => {
    // Only fetch if:
    // 1. No seeded hero (or it failed)
    // 2. No curated images available
    // 3. Haven't already fetched
    const shouldFetch = 
      (!seededHeroUrl || seededFailed) && 
      !hasCurated && 
      !apiFetched;

    if (!shouldFetch) return;

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
  }, [destination, seededHeroUrl, seededFailed, hasCurated, apiFetched]);

  // Determine current image URL based on fallback chain
  const getImageUrl = (): { url: string; source: UseTripHeroImageResult['source'] } => {
    // 1. Seeded hero (if not failed)
    if (seededHeroUrl && !seededFailed) {
      return { url: seededHeroUrl, source: 'seeded' };
    }

    // 2. Curated images (if available and not all failed)
    if (hasCurated && !curatedFailed && curatedImages[curatedIndex]) {
      return { url: curatedImages[curatedIndex], source: 'curated' };
    }

    // 3. API fetched image
    if (apiImageUrl && !apiFailed) {
      return { url: apiImageUrl, source: 'api' };
    }

    // 4. Gradient fallback
    return { 
      url: generateDestinationGradient(tripId || destination), 
      source: 'gradient' 
    };
  };

  const { url: imageUrl, source } = getImageUrl();

  const onError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
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
        // All curated images failed
        setCuratedFailed(true);
      }
      return;
    }

    // Handle API image failure
    if (apiImageUrl && !apiFailed) {
      setApiFailed(true);
      return;
    }

    // All sources failed - gradient fallback is always safe
    // Prevent infinite loop by setting a data-url placeholder
    const img = e.currentTarget;
    if (!img.src.startsWith('data:')) {
      img.src = generateDestinationGradient(tripId || destination);
    }
  }, [
    seededHeroUrl, 
    seededFailed, 
    hasCurated, 
    curatedFailed, 
    curatedIndex, 
    curatedImages.length,
    apiImageUrl,
    apiFailed,
    tripId,
    destination
  ]);

  return {
    imageUrl,
    isLoading,
    source,
    onError,
  };
}
