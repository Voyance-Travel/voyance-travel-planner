const SITE_IMAGES_BUCKET = 'site-images';
export const PLACEHOLDER_TRAVEL_SRC = '/placeholder-travel.svg';

function getSiteImagesBaseUrl(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) return '';
  return `${base}/storage/v1/object/public/${SITE_IMAGES_BUCKET}`;
}

export function extractPhotoId(value?: string | null): string | null {
  if (!value) return null;
  const input = value.trim();
  if (!input) return null;

  const direct = input.match(/(photo-[a-z0-9-]+)/i)?.[1];
  if (direct) return direct.toLowerCase();

  try {
    const parsed = new URL(input);
    const fromPath = parsed.pathname.match(/(photo-[a-z0-9-]+)/i)?.[1];
    if (fromPath) return fromPath.toLowerCase();
  } catch {
    return null;
  }

  return null;
}

export function isUnsplashUrl(url?: string | null): boolean {
  if (!url) return false;
  return /(?:source|images|api)\.unsplash\.com/i.test(url);
}

export function toSiteImageUrlFromPhotoId(photoId?: string | null): string {
  const id = (photoId || '').trim().toLowerCase();
  const base = getSiteImagesBaseUrl();
  if (!id || !id.startsWith('photo-') || !base) return PLACEHOLDER_TRAVEL_SRC;
  return `${base}/${id}`;
}

/**
 * Converts legacy Unsplash URLs (or raw photo IDs) to internal storage URLs.
 * Falls back to placeholder when we cannot extract a valid photo id.
 */
export function normalizeUnsplashUrl(url?: string | null): string {
  if (!url) return PLACEHOLDER_TRAVEL_SRC;

  const value = url.trim();
  if (!value) return PLACEHOLDER_TRAVEL_SRC;

  // Local or data assets — pass through.
  if (value.startsWith('/') || value.startsWith('data:')) {
    return value;
  }

  // Any reference carrying an Unsplash photo id — an Unsplash CDN URL, a legacy
  // `site-images` bucket URL, or a bare `photo-…` id — is served straight from
  // the Unsplash CDN. The `site-images` bucket is NOT populated on this project,
  // so the previous behavior (rewrite to that bucket) 404'd every image.
  const photoId = extractPhotoId(value);
  if (photoId) {
    return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1600&q=80`;
  }

  // Anything else (populated storage objects, other CDNs) — pass through.
  return value;
}

