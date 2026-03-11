import { ImgHTMLAttributes, SyntheticEvent, useMemo } from 'react';
import { normalizeUnsplashUrl, PLACEHOLDER_TRAVEL_SRC } from '@/utils/unsplash';

export type ImageCategory = 'dining' | 'sightseeing' | 'nightlife' | 'accommodation' | 'shopping' | 'transport' | 'nature' | 'default';

/** Category-specific gradient SVG data URIs — no external files needed */
const CATEGORY_FALLBACKS: Record<ImageCategory, string> = {
  dining: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23e8a87c'/%3E%3Cstop offset='100%25' stop-color='%23d4845a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3Ctext x='400' y='310' text-anchor='middle' font-family='system-ui' font-size='36' fill='%23fff' opacity='.5'%3E🍽%3C/text%3E%3C/svg%3E",
  sightseeing: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%235b9bd5'/%3E%3Cstop offset='100%25' stop-color='%233a7bb8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3Ctext x='400' y='310' text-anchor='middle' font-family='system-ui' font-size='36' fill='%23fff' opacity='.5'%3E📸%3C/text%3E%3C/svg%3E",
  nightlife: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%237b61c4'/%3E%3Cstop offset='100%25' stop-color='%235a3e9e'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3Ctext x='400' y='310' text-anchor='middle' font-family='system-ui' font-size='36' fill='%23fff' opacity='.5'%3E🌙%3C/text%3E%3C/svg%3E",
  accommodation: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23c7a87c'/%3E%3Cstop offset='100%25' stop-color='%23a88a5e'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3Ctext x='400' y='310' text-anchor='middle' font-family='system-ui' font-size='36' fill='%23fff' opacity='.5'%3E🏨%3C/text%3E%3C/svg%3E",
  shopping: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23e87ca8'/%3E%3Cstop offset='100%25' stop-color='%23d45a8a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3Ctext x='400' y='310' text-anchor='middle' font-family='system-ui' font-size='36' fill='%23fff' opacity='.5'%3E🛍%3C/text%3E%3C/svg%3E",
  transport: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%2370a9a1'/%3E%3Cstop offset='100%25' stop-color='%23508b83'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3Ctext x='400' y='310' text-anchor='middle' font-family='system-ui' font-size='36' fill='%23fff' opacity='.5'%3E✈️%3C/text%3E%3C/svg%3E",
  nature: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%2388b06a'/%3E%3Cstop offset='100%25' stop-color='%236a9450'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3Ctext x='400' y='310' text-anchor='middle' font-family='system-ui' font-size='36' fill='%23fff' opacity='.5'%3E🌿%3C/text%3E%3C/svg%3E",
  default: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23e8d5c4'/%3E%3Cstop offset='100%25' stop-color='%23c7b299'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3C/svg%3E",
};

/** Resolve a category string (e.g. from activity.category) to a known ImageCategory */
export function resolveImageCategory(category?: string | null): ImageCategory {
  if (!category) return 'default';
  const lower = category.toLowerCase();
  if (/food|dining|restaurant|eat|meal|breakfast|lunch|dinner|cafe/i.test(lower)) return 'dining';
  if (/sight|landmark|museum|tour|culture|history|attraction|temple|church/i.test(lower)) return 'sightseeing';
  if (/night|bar|club|pub|drink|entertainment/i.test(lower)) return 'nightlife';
  if (/hotel|accommodation|stay|lodge|hostel|resort|airbnb/i.test(lower)) return 'accommodation';
  if (/shop|market|mall|store|boutique/i.test(lower)) return 'shopping';
  if (/transport|flight|train|bus|taxi|transfer|airport/i.test(lower)) return 'transport';
  if (/nature|park|hike|outdoor|beach|garden|mountain|trail/i.test(lower)) return 'nature';
  return 'default';
}

export function getFallbackForCategory(category?: ImageCategory | string | null): string {
  if (!category) return CATEGORY_FALLBACKS.default;
  const resolved = (category in CATEGORY_FALLBACKS)
    ? category as ImageCategory
    : resolveImageCategory(category);
  return CATEGORY_FALLBACKS[resolved];
}

type SafeImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Activity/content category for category-aware fallback gradient */
  fallbackCategory?: ImageCategory | string;
};

export default function SafeImage({
  src,
  alt,
  loading,
  onError,
  fallbackCategory,
  ...props
}: SafeImageProps) {
  const normalizedSrc = useMemo(() => normalizeUnsplashUrl(typeof src === 'string' ? src : ''), [src]);

  const fallbackSrc = useMemo(
    () => fallbackCategory ? getFallbackForCategory(fallbackCategory) : PLACEHOLDER_TRAVEL_SRC,
    [fallbackCategory]
  );

  const handleError = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallbackApplied === 'true') return;
    img.dataset.fallbackApplied = 'true';
    img.src = fallbackSrc;
    onError?.(e);
  };

  return (
    <img
      src={normalizedSrc}
      alt={alt ?? ''}
      loading={loading ?? 'lazy'}
      onError={handleError}
      {...props}
    />
  );
}
