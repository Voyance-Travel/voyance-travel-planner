const BROKEN_UNSPLASH_IDS = new Set([
  'photo-1563177978-4f4a11e3f462',
  'photo-1579606032821-4e6161c81571',
  'photo-1469854523086-cc02fe5d8800',
  'photo-1613395877344-13d4a8e0d49e',
  'photo-1513635269975-59663e0ac1ad',
  'photo-1512635269975-5963e0ac1ad',
]);

const DEFAULT_FALLBACK_PHOTO_ID = 'photo-1488646953014-85cb44e25828';

export const PLACEHOLDER_TRAVEL_SRC = '/placeholder-travel.svg';

function hasBrokenUnsplashId(url: string): boolean {
  return Array.from(BROKEN_UNSPLASH_IDS).some((id) => url.includes(id));
}

function parseSourceUnsplashDimensions(url: string): { width: number; height: number } {
  const match = url.match(/source\.unsplash\.com\/(\d+)x(\d+)\//i);
  const width = Number(match?.[1] || 1600);
  const height = Number(match?.[2] || 900);
  return { width, height };
}

export function isUnsplashUrl(url?: string | null): boolean {
  if (!url) return false;
  return /(?:source|images|api)\.unsplash\.com/i.test(url);
}

/**
 * Normalizes Unsplash URLs to the stable images CDN pattern with explicit params.
 * Also blocks known-broken photo IDs and deprecated source.unsplash URLs.
 */
export function normalizeUnsplashUrl(url?: string | null): string {
  if (!url) return PLACEHOLDER_TRAVEL_SRC;

  const value = url.trim();
  if (!value) return PLACEHOLDER_TRAVEL_SRC;

  if (!isUnsplashUrl(value)) {
    return value;
  }

  if (hasBrokenUnsplashId(value)) {
    return PLACEHOLDER_TRAVEL_SRC;
  }

  if (value.includes('source.unsplash.com')) {
    const { width, height } = parseSourceUnsplashDimensions(value);
    return `https://images.unsplash.com/${DEFAULT_FALLBACK_PHOTO_ID}?w=${width}&h=${height}&fit=crop&auto=format&q=80`;
  }

  try {
    const parsed = new URL(value);

    if (!parsed.hostname.includes('images.unsplash.com')) {
      return value;
    }

    const id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (id && BROKEN_UNSPLASH_IDS.has(id)) {
      return PLACEHOLDER_TRAVEL_SRC;
    }

    if (!parsed.searchParams.has('auto')) parsed.searchParams.set('auto', 'format');
    if (!parsed.searchParams.has('fit')) parsed.searchParams.set('fit', 'crop');
    if (!parsed.searchParams.has('q')) parsed.searchParams.set('q', '80');

    return parsed.toString();
  } catch {
    return value;
  }
}
