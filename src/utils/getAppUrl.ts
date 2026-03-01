/**
 * Returns the canonical public URL for the app.
 * 
 * In production (published site), this returns window.location.origin.
 * In preview/dev environments, this returns the published URL so that
 * shareable links (invites, referrals, etc.) always work for recipients.
 */

const PUBLISHED_URL = 'https://voyance-travel-planner.lovable.app';

export function getAppUrl(): string {
  if (typeof window === 'undefined') return PUBLISHED_URL;

  const origin = window.location.origin;

  // If we're on the published domain or a custom domain, use it directly
  if (
    origin === PUBLISHED_URL ||
    origin.includes('travelwithvoyance.com') ||
    origin.startsWith('http://localhost')
  ) {
    return origin;
  }

  // Otherwise (preview URLs, deploy previews, etc.) use the published URL
  return PUBLISHED_URL;
}
