/**
 * Client-side mirror of the server's wellness placeholder detection
 * (supabase/functions/generate-itinerary/fix-placeholders.ts).
 *
 * Catches generic spa/wellness titles the AI produces with no real venue:
 * "Private Wellness Refresh", "Glow & Wellness Facial Ritual",
 * "Personalized Wellness Treatment", "Spa Time", etc.
 *
 * Per the Wellness Venue Integrity core memory these are BANNED — when no
 * real venue can be confirmed we mask the title to "Spa Time — find a venue".
 */

export const GENERIC_WELLNESS_TITLE_PATTERNS: RegExp[] = [
  /^(private\s+)?(wellness|spa)\s+(refresh|moment|break|session|time|experience|treatment|ritual|escape)\.?$/i,
  /^(spa|wellness|massage|hammam|sauna|thermal)(\s+(at|in)\s+(a|an|the|your)\s+.+)?$/i,
  /^(relaxing|rejuvenating|luxurious|private|quick|brief|short|personalized|personalised|customized|customised|bespoke|signature|tailored|curated|exclusive|premium|deluxe|indulgent|restorative|holistic)\s+(spa|wellness|massage|treatment|hammam|experience|ritual|session|facial|skincare|beauty|pampering)\b/i,
  /^(personalized|personalised|customized|customised|bespoke|signature|tailored|curated|exclusive|premium|deluxe|indulgent|holistic|restorative)\s+(wellness|spa|massage|treatment|experience|ritual|session|facial|skincare|beauty|pampering)\b/i,
  /^(wellness|spa)\s+(experience|treatment|ritual|session)\s+(at|in)\s+(a|an|the|your)\s+/i,
  /^(hotel\s+)?(spa|wellness)\s+(time|break|stop|moment)$/i,
  /^pamper\s+yourself/i,
  /^unwind\s+(at\s+)?(the\s+)?(spa|hotel|hammam)?\.?$/i,
  /^(wellness|spa)\s+(refresh|moment|break|session|time|experience|treatment|ritual|escape|visit|stop)$/i,
  /^(curated|bespoke|signature|personalized|personalised|premium|luxury|private|exclusive)\s+(wellness|spa)\s+(visit|stop|appointment|hour|hours)\b/i,
  /^(glow|radiance|bliss|escape|serenity|tranquility|tranquillity|harmony|balance|renewal|refresh|zen|aura)\s*[&+]?\s*(wellness|spa|beauty|skincare|facial|ritual)\b/i,
  /^(facial|beauty|skincare|pampering)\s+(ritual|session|experience|treatment|moment|escape)\b/i,
];

const WELLNESS_KEYWORD_RE =
  /\b(spa|wellness|massage|hammam|sauna|onsen|thermal|treatment|ritual|facial|skincare|beauty|pampering|hot\s*spring|hot\s*tub|jacuzzi|cryotherapy|reflexology|aromatherapy)\b/i;

const GENERIC_WELLNESS_VENUE_PATTERNS: RegExp[] = [
  /^(the\s+)?(spa|wellness|salon|hammam|sauna)$/i,
  /^(hotel|on-?site|in-?house|on\s+property|property|resort)\s+(spa|wellness|salon|gym)$/i,
  /^(a|the|your)\s+(hotel|spa|wellness|destination|salon)/i,
  /\b(spa|wellness)\s+(in|at|near|by)\s+(the\s+)?(hotel|property|resort)\b/i,
  /^(luxury|boutique|upscale|premium|local|nearby|popular|recommended)\s+(spa|wellness|salon)\b/i,
];

export interface WellnessActivityShape {
  title?: string;
  name?: string;
  category?: string;
  venue_name?: string;
  location?: { name?: string; address?: string } | null;
  metadata?: {
    google_place_id?: string;
    placeId?: string;
    unverified_venue?: boolean;
  } | null;
  verified?: { placeId?: string } | null;
}

export function hasGenericWellnessTitle(title: string | undefined | null): boolean {
  if (!title) return false;
  const t = title.trim();
  if (!t) return false;
  return GENERIC_WELLNESS_TITLE_PATTERNS.some((re) => re.test(t));
}

/**
 * Returns true if the activity is a wellness/spa entry with no verifiable venue.
 * Mirrors `isPlaceholderWellness` from fix-placeholders.ts (sans cityName/hotelName
 * checks the client doesn't always have).
 */
export function isClientPlaceholderWellness(activity: WellnessActivityShape | null | undefined): boolean {
  if (!activity) return false;
  const category = (activity.category || '').toLowerCase();
  const title = (activity.title || activity.name || '').trim();
  const venue = ((activity.location?.name) || activity.venue_name || '').trim();
  const address = String(activity.location?.address || '').trim();

  const isWellnessCat = category === 'wellness' || category === 'spa';
  const isWellnessTitle = WELLNESS_KEYWORD_RE.test(title);
  if (!isWellnessCat && !isWellnessTitle) return false;

  // Confirmed placeId → real venue
  const hasPlaceId =
    !!activity?.metadata?.google_place_id ||
    !!activity?.metadata?.placeId ||
    !!activity?.verified?.placeId;
  if (hasPlaceId) return false;

  // Title is generic placeholder
  if (hasGenericWellnessTitle(title)) return true;

  // Venue is empty / generic
  const venueLower = venue.toLowerCase();
  const isGenericVenue =
    venue.length < 4 ||
    venueLower === 'your hotel' ||
    venueLower === 'the destination' ||
    venueLower === 'the city' ||
    GENERIC_WELLNESS_VENUE_PATTERNS.some((re) => re.test(venue));

  if (isGenericVenue) {
    const hasNamedVenue = / at [A-Z][\w'’-]+(?:\s+[A-Z&][\w'’-]+){0,5}/.test(title);
    if (!hasNamedVenue) return true;
  }

  // Otherwise require a real numeric address or explicit verification
  const hasNumericAddress = address.length >= 8 && /\d/.test(address);
  const explicitlyVerified = activity?.metadata?.unverified_venue === false;
  if (!hasNumericAddress && !explicitlyVerified) return true;

  return false;
}

export const WELLNESS_PLACEHOLDER_FALLBACK = 'Spa Time — find a venue';
