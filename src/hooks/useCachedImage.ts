import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Checks the destination_image_cache table for a stored image.
 * If not cached, triggers the edge function to download + store it.
 * Returns the storage URL (ours) or falls back to the original.
 */
export function useCachedDestinationImage(
  destinationSlug: string | undefined,
  originalUrl: string | undefined,
  imageType: string = 'hero'
) {
  return useQuery({
    queryKey: ['cached-destination-image', destinationSlug, imageType],
    queryFn: async () => {
      if (!destinationSlug || !originalUrl) return originalUrl || null;

      // 1. Check cache table first (fast DB read)
      const { data: cached } = await supabase
        .from('destination_image_cache')
        .select('storage_url, expires_at')
        .eq('destination_slug', destinationSlug)
        .eq('image_type', imageType)
        .maybeSingle();

      if (cached && new Date(cached.expires_at) > new Date()) {
        return cached.storage_url;
      }

      // 2. No cache hit — trigger edge function to download & store
      try {
        const { data, error } = await supabase.functions.invoke(
          'cache-destination-image',
          {
            body: { destinationSlug, originalUrl, imageType },
          }
        );

        if (!error && data?.url) {
          return data.url as string;
        }
      } catch (e) {
        console.warn('[useCachedImage] Cache miss, using original URL:', e);
      }

      // 3. Fallback to original URL
      return originalUrl;
    },
    enabled: !!destinationSlug && !!originalUrl,
    staleTime: 1000 * 60 * 60, // 1 hour — cache is long-lived
    gcTime: 1000 * 60 * 60 * 24, // Keep in memory 24h
    retry: false, // Don't retry — fallback to original is fine
  });
}
