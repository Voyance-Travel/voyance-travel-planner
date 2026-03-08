/**
 * Returns the canonical public URL for the app.
 * 
 * All shareable links (invites, referrals, guides, archetypes, intake forms)
 * always point to the production custom domain so recipients can access them.
 * Auth-related flows (OAuth, password reset) use window.location.origin directly
 * and are NOT routed through this utility.
 */

const PUBLISHED_URL = 'https://travelwithvoyance.com';

export function getAppUrl(): string {
  if (typeof window === 'undefined') return PUBLISHED_URL;

  const origin = window.location.origin;

  // Production custom domain — use as-is
  if (origin.includes('travelwithvoyance.com')) {
    return origin;
  }

  // All other environments (Capacitor, Lovable preview, localhost)
  // → always use the production domain for shareable links
  return PUBLISHED_URL;
}
