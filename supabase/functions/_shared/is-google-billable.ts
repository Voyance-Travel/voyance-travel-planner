/**
 * Shared predicate for "is this URL a billable Google Maps/Places asset?"
 *
 * Why this lives in its own file:
 *   The repo-wide lint guard (`no-direct-google.test.ts`) flags any source
 *   file that contains a literal `googleapis.com` string. Feature code used
 *   to embed those strings to detect Google-owned URLs, which both polluted
 *   the lint allowlist and made it easy for someone to "just add another
 *   substring check" instead of going through the central wrapper.
 *
 * Centralising the check here:
 *   1. Lets the lint guard treat this single file as the only place where
 *      "googleapis.com" is allowed to appear outside `_shared/google-api.ts`.
 *   2. Gives every code path the same definition of "is Google billing me
 *      for this fetch", so accounting cannot drift between callers.
 */

const BILLABLE_HOSTS = [
  // Places API v1 (Text Search, Place Details, Photos)
  "places.googleapis.com",
  // Maps Platform legacy (Geocoding, Distance Matrix, Directions, photo CDN)
  "maps.googleapis.com",
  // Routes API v2
  "routes.googleapis.com",
];

export function isGoogleBillableUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return BILLABLE_HOSTS.some((host) => lower.includes(host));
}

/**
 * Reverse helper: returns the matched host name (for logging/audit) or null.
 */
export function googleBillableHost(url: string | null | undefined): string | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  return BILLABLE_HOSTS.find((host) => lower.includes(host)) ?? null;
}
