/**
 * Shared Photo Storage Utility
 * 
 * Downloads photos from Google Places/TripAdvisor ONCE and stores them
 * in Supabase Storage. Returns our own CDN URL to avoid repeated API calls.
 * 
 * CRITICAL: Every time a browser loads a Google Places photo URL with your
 * API key, Google charges you ~$0.007. This utility fetches once and caches.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const BUCKET_NAME = 'trip-photos';
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface PhotoCacheResult {
  url: string;
  cached: boolean;
  source: 'storage' | 'direct';
}

/**
 * Get a cached photo URL from Supabase Storage, or download and cache it
 */
export async function getCachedPhotoUrl(
  entityType: 'restaurant' | 'hotel' | 'activity' | 'destination',
  entityId: string,
  googlePhotoUrl: string,
  metadata?: {
    destination?: string;
    placeName?: string;
    placeId?: string;
  }
): Promise<PhotoCacheResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  
  // Generate storage path
  const sanitizedId = entityId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80);
  const storagePath = `${entityType}/${sanitizedId}.jpg`;
  
  // Check if already in storage
  const { data: existingFile } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 60); // Just checking if exists
  
  if (existingFile?.signedUrl) {
    // File exists - return public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
    console.log(`[PhotoStorage] Cache hit: ${entityType}/${sanitizedId}`);
    return { url: publicUrl, cached: true, source: 'storage' };
  }
  
  // Download the photo from Google
  try {
    console.log(`[PhotoStorage] Downloading: ${entityType}/${sanitizedId}`);
    const photoResponse = await fetch(googlePhotoUrl, {
      headers: { 'Accept': 'image/*' }
    });
    
    if (!photoResponse.ok) {
      console.error(`[PhotoStorage] Download failed: ${photoResponse.status}`);
      return { url: googlePhotoUrl, cached: false, source: 'direct' };
    }
    
    const photoBlob = await photoResponse.blob();
    
    // Validate it's actually an image
    if (!photoBlob.type.startsWith('image/')) {
      console.error(`[PhotoStorage] Not an image: ${photoBlob.type}`);
      return { url: googlePhotoUrl, cached: false, source: 'direct' };
    }
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, photoBlob, {
        contentType: photoBlob.type,
        upsert: true,
        cacheControl: '31536000', // 1 year cache
      });
    
    if (uploadError) {
      console.error(`[PhotoStorage] Upload failed:`, uploadError);
      return { url: googlePhotoUrl, cached: false, source: 'direct' };
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
    
    return { url: publicUrl, cached: true, source: 'storage' };
  } catch (error) {
    console.error(`[PhotoStorage] Error:`, error);
    return { url: googlePhotoUrl, cached: false, source: 'direct' };
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
  }>
): Promise<PhotoCacheResult[]> {
  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  const results: PhotoCacheResult[] = [];
  
  for (let i = 0; i < photos.length; i += CONCURRENCY) {
    const batch = photos.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(p => getCachedPhotoUrl(p.entityType, p.entityId, p.googlePhotoUrl, p.metadata))
    );
    results.push(...batchResults);
  }
  
  return results;
}
