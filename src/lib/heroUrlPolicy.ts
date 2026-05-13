/**
 * Shared hero-image URL trust policy.
 *
 * A URL flagged untrusted should be skipped at every read site (seeded trip
 * metadata, canonical destinations.hero_image_url, curated_images table, and
 * API results). The resolver's existing write-back path will overwrite a
 * stored bad value with a freshly-resolved good one on next visit, so trips
 * self-heal without a manual purge.
 *
 * Why `images.unsplash.com`: legacy seeds use raw photo IDs whose labels
 * (e.g. "Montreal Old Port") were never verified against the photo content,
 * and the CDN itself returns 403/expired silently. Treat the entire host
 * as untrusted for hero usage.
 */
export function isUntrustedHeroUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (/images\.unsplash\.com/i.test(trimmed)) return true;
  if (/source\.unsplash\.com/i.test(trimmed)) return true;
  return false;
}
