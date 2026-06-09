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
/**
 * People/business content slugs banned from destination heroes.
 * Defense-in-depth — primary guard is in tryUnsplashFallback's
 * alt/description/tag check, but if a poisoned URL slipped past
 * (cached row, write-back, etc.) the slug typically still names the
 * subject. Keeping it slug-scoped avoids false positives on legit
 * landmarks ("london-suit-shop" is rare; "two-businessmen-handshake"
 * is the real failure mode).
 */
const PEOPLE_CONTENT_SLUG_RE =
  /\b(businessman|businesswoman|business[-_]?(?:meeting|people|men|women)|handshake|board[-_]?meeting|office[-_]?meeting|conference[-_]?room|portrait|headshot|model[-_]?(?:photo|shoot)|crowd[-_]?of[-_]?people|group[-_]?of[-_]?people)\b/i;

export function isUntrustedHeroUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (/images\.unsplash\.com/i.test(trimmed)) return true;
  if (/source\.unsplash\.com/i.test(trimmed)) return true;
  // Old Lovable Supabase host. Its hero/destination storage buckets were never
  // migrated to the owner-owned project, so every image still pointing here
  // (94 destination rows + ~18 trips + the legacy storage-map constant) loads
  // from a host slated for decommission — and some seeds are mislabeled
  // (destination-images/destination/barcelona-1.jpg is actually a Madrid photo).
  // Treat the whole host as untrusted so the resolver advances to the
  // destination-images API tier, which fetches a correct, city-matched image and
  // stores it on the NEW host; the existing write-back path then self-heals the
  // stored URL. Removes the app's runtime dependency on the old project.
  if (/jsxplunjjvxuejeouwob\.supabase\.co/i.test(trimmed)) return true;
  if (PEOPLE_CONTENT_SLUG_RE.test(trimmed)) return true;
  return false;
}
