/**
 * Shared Photo Storage Utility
 * 
 * Downloads photos from Google Places/TripAdvisor ONCE and stores them
 * in Supabase Storage. Returns our own CDN URL to avoid repeated API calls.
 * 
 * CRITICAL: Every time a browser loads a Google Places photo URL with your
 * API key, Google charges you ~$0.007. This utility fetches once and caches.
 */

import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { type CostTracker, trackCost } from "./cost-tracker.ts";
import { isGoogleBillableUrl } from "./is-google-billable.ts";

const BUCKET_NAME = 'trip-photos';
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface PhotoCacheResult {
  url: string;
  cached: boolean;
  /** True only when the object was already present in storage (no download performed) */
  cacheHit: boolean;
  source: 'storage' | 'direct';
}

/**
 * Get a cached photo URL from Supabase Storage, or download and cache it.
 *
 * Pass a `costTracker` whenever possible — every cache MISS triggers a Google
 * Places photo download (one billable `places_photo` SKU). Without a tracker,
 * the download still happens but the cost is silently lost from our internal
 * accounting (this is the historical bug behind under-reported Google spend).
 */
export async function getCachedPhotoUrl(
  entityType: 'restaurant' | 'hotel' | 'activity' | 'destination',
  entityId: string,
  googlePhotoUrl: string,
  metadata?: {
    destination?: string;
    placeName?: string;
    placeId?: string;
  },
  costTracker?: CostTracker,
): Promise<PhotoCacheResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  
  // Generate storage path
  const sanitizedId = entityId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80);
  const storagePath = `${entityType}/${sanitizedId}.jpg`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
  
  // Check if already in storage using a HEAD request against the public URL.
  // The old approach (createSignedUrl) silently fails on public buckets,
  // causing every request to re-download from Google ($0.007/hit).
  try {
    const headResp = await fetch(publicUrl, { method: 'HEAD' });
    if (headResp.ok) {
      const contentLength = parseInt(headResp.headers.get('content-length') || '0', 10);
      // Ensure it's a real image (not a 0-byte or error page)
      if (contentLength > 500) {
        console.log(`[PhotoStorage] Cache hit: ${entityType}/${sanitizedId} (${contentLength} bytes)`);
        return { url: publicUrl, cached: true, cacheHit: true, source: 'storage' };
      }
    }
  } catch {
    // HEAD failed — fall through to download
  }
  
  // Download the photo from Google
  try {
    console.log(`[PhotoStorage] Downloading: ${entityType}/${sanitizedId}`);

    // Follow redirects (Google Places API redirects to actual image)
    const photoResponse = await fetch(googlePhotoUrl, {
      headers: { 'Accept': 'image/*' },
      redirect: 'follow',
    });

    // Always count the call — Google bills the request, not the success.
    // Only Places-style URLs are billable; skip TripAdvisor/Foursquare/etc.
    // ENFORCEMENT: if this is a billable Google URL we MUST record a SKU,
    // even if the caller forgot to thread a tracker through. Historically
    // this was a `console.warn` and the cost vanished from accounting,
    // which is the leak the team has chased multiple times. We now lazily
    // create + save a tracker so accounting is guaranteed.
    if (isGoogleBillableUrl(googlePhotoUrl)) {
      if (costTracker) {
        costTracker.recordGooglePhotos(1);
      } else {
        console.warn(
          `[PhotoStorage] Photo download for ${entityType}/${sanitizedId} ` +
            `was not attributed to a CostTracker — falling back to a lazy ` +
            `tracker so accounting is preserved. Pass a CostTracker for ` +
            `correct per-action attribution.`,
        );
        const lazy = trackCost('photo_storage_uncategorized');
        lazy.recordGooglePhotos(1);
        // Fire-and-forget save — we never want photo logic to fail because
        // accounting persistence had a hiccup, but we do want the row.
        lazy.save().catch((err) =>
          console.error('[PhotoStorage] Lazy tracker save failed:', err),
        );
      }
    }

    if (!photoResponse.ok) {
      console.error(`[PhotoStorage] Download failed: ${photoResponse.status}`);
      return { url: googlePhotoUrl, cached: false, cacheHit: false, source: 'direct' };
    }

    // Read as ArrayBuffer for reliable binary handling
    const arrayBuffer = await photoResponse.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    
    // Validate it's actually an image by checking magic bytes
    const isJpeg = uint8[0] === 0xFF && uint8[1] === 0xD8;
    const isPng = uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47;
    const isWebp = uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46;
    
    if (!isJpeg && !isPng && !isWebp) {
      // Check if it's actually HTML (error page)
      const firstBytes = new TextDecoder().decode(uint8.slice(0, 100));
      if (firstBytes.includes('<!DOCTYPE') || firstBytes.includes('<html') || firstBytes.includes('error')) {
        console.error(`[PhotoStorage] Downloaded content is HTML/error, not an image`);
        return { url: googlePhotoUrl, cached: false, cacheHit: false, source: 'direct' };
      }
      console.warn(`[PhotoStorage] Unknown image format, proceeding anyway`);
    }
    
    const contentType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, uint8, {
        contentType,
        upsert: true,
        cacheControl: '31536000', // 1 year cache
      });
    
    if (uploadError) {
      console.error(`[PhotoStorage] Upload failed:`, uploadError);
      return { url: googlePhotoUrl, cached: false, cacheHit: false, source: 'direct' };
    }
    
    // Return public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
    console.log(`[PhotoStorage] Cached successfully: ${publicUrl}`);
    
    // Also update curated_images table for tracking
    if (metadata?.destination) {
      try {
        await supabase.from('curated_images').upsert({
          entity_type: entityType,
          entity_key: sanitizedId,
          destination: metadata.destination,
          source: 'google_places_cached',
          image_url: publicUrl,
          alt_text: metadata.placeName ? `${metadata.placeName}` : undefined,
          place_id: metadata.placeId,
          quality_score: 0.85,
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        }, { onConflict: 'entity_type,entity_key,destination' });
      } catch { /* ignore tracking errors */ }
    }
    
    // This was a cache MISS (we downloaded then cached)
    return { url: publicUrl, cached: true, cacheHit: false, source: 'storage' };
  } catch (error) {
    console.error(`[PhotoStorage] Error:`, error);
    return { url: googlePhotoUrl, cached: false, cacheHit: false, source: 'direct' };
  }
}

/**
 * Batch cache multiple photos (for efficiency)
 */
export async function batchCachePhotos(
  photos: Array<{
    entityType: 'restaurant' | 'hotel' | 'activity' | 'destination';
    entityId: string;
    googlePhotoUrl: string;
    metadata?: { destination?: string; placeName?: string; placeId?: string };
  }>,
  costTracker?: CostTracker,
): Promise<PhotoCacheResult[]> {
  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  const results: PhotoCacheResult[] = [];

  for (let i = 0; i < photos.length; i += CONCURRENCY) {
    const batch = photos.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(p => getCachedPhotoUrl(p.entityType, p.entityId, p.googlePhotoUrl, p.metadata, costTracker))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Cache a Google Places v1 photo by its resource name (e.g. "places/X/photos/Y")
 * without forcing the caller to hand-build a key-bearing URL.
 *
 * Centralising URL construction here means feature code never contains a
 * literal `googleapis.com` string, the lint guard stays clean, and the
 * single SKU-recording path in `getCachedPhotoUrl` is the only way photos
 * can be downloaded from Google.
 */
export async function getCachedPlacesPhotoByResource(
  entityType: 'restaurant' | 'hotel' | 'activity' | 'destination',
  entityId: string,
  photoResource: string,
  options?: {
    maxWidthPx?: number;
    maxHeightPx?: number;
    metadata?: { destination?: string; placeName?: string; placeId?: string };
    costTracker?: CostTracker;
  },
): Promise<PhotoCacheResult> {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';
  if (!apiKey) {
    return { url: '', cached: false, cacheHit: false, source: 'direct' };
  }
  const qs: string[] = [`key=${apiKey}`];
  if (options?.maxWidthPx) qs.push(`maxWidthPx=${options.maxWidthPx}`);
  if (options?.maxHeightPx) qs.push(`maxHeightPx=${options.maxHeightPx}`);
  // Resource name is e.g. "places/ChIJ.../photos/AeY..." — already URL-safe.
  const url = `https://places.googleapis.com/v1/${photoResource}/media?${qs.join('&')}`;
  return getCachedPhotoUrl(entityType, entityId, url, options?.metadata, options?.costTracker);
}
