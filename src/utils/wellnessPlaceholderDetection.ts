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
export const HOTEL_LOGISTICS_TITLE_RE =
  /^\s*(luggage[\s-]?drop|drop\s+bags|bag[\s-]?drop|check[\s-]?in|check[\s-]?out|checkin|checkout|freshen[\s-]?up|return\s+to|settle\s+in|hotel\s+arrival|arrive\s+at\s+(your\s+)?hotel|transfer\s+to)/i;

export function isClientPlaceholderWellness(activity: WellnessActivityShape | null | undefined): boolean {
  if (!activity) return false;
  const category = (activity.category || '').toLowerCase();
  const title = (activity.title || activity.name || '').trim();
  const venue = ((activity.location?.name) || activity.venue_name || '').trim();
  const address = String(activity.location?.address || '').trim();

  // Hotel logistics & transport short-circuit — these cards are never wellness,
  // even if the hotel name happens to contain "Spa" (e.g. "JW Marriott Venice
  // Resort & Spa", "Gritti Palace Spa", "Six Senses Spa").
  // Also short-circuit when the venue clearly looks like a hotel/resort, so a
  // missing/dropped category from the caller doesn't trigger a false positive
  // mask of "Return to JW Marriott Venice Resort & Spa".
  const HOTEL_VENUE_RE = /\b(hotel|resort|inn|lodge|guesthouse|hostel|palazzo|palace|hyatt|marriott|hilton|ritz|sheraton|westin|four\s+seasons|aman|six\s+senses|st\.?\s+regis|park\s+hyatt|grand\s+hyatt|jw\s+marriott)\b/i;
  if (
    category === 'accommodation' ||
    category === 'stay' ||
    category === 'transport' ||
    category === 'transportation' ||
    category === 'transit' ||
    HOTEL_LOGISTICS_TITLE_RE.test(title) ||
    HOTEL_VENUE_RE.test(venue)
  ) {
    return false;
  }

  const isWellnessCat = category === 'wellness' || category === 'spa';
  const isWellnessTitle = WELLNESS_KEYWORD_RE.test(title);
  if (!isWellnessCat && !isWellnessTitle) return false;

  // Confirmed placeId → real venue
  const hasPlaceId =
    !!activity?.metadata?.google_place_id ||
    !!activity?.metadata?.placeId ||
    !!activity?.verified?.placeId;
  if (hasPlaceId) return false;

  // Real venue exit (runs BEFORE generic-title check):
  // a non-generic named venue with a plausible numeric address (or known
  // curated allowlist hit) means the activity is real even if the title
  // is still generic — we'll rewrite the title elsewhere, not mask it.
  const venueLower = venue.toLowerCase();
  const isGenericVenue =
    venue.length < 4 ||
    venueLower === 'your hotel' ||
    venueLower === 'the destination' ||
    venueLower === 'the city' ||
    GENERIC_WELLNESS_VENUE_PATTERNS.some((re) => re.test(venue));
  const hasNumericAddress = address.length >= 8 && /\d/.test(address);
  const inAllowlist = WELLNESS_VENUE_ALLOWLIST.has(venueLower);
  const explicitlyVerified = activity?.metadata?.unverified_venue === false;
  if (!isGenericVenue && (hasNumericAddress || inAllowlist || explicitlyVerified)) {
    return false;
  }

  // Title is generic placeholder (and venue isn't proven real above)
  if (hasGenericWellnessTitle(title)) return true;

  if (isGenericVenue) {
    const hasNamedVenue = / at [A-Z][\w'’-]+(?:\s+[A-Z&][\w'’-]+){0,5}/.test(title);
    if (!hasNamedVenue) return true;
  }

  // Otherwise require a real numeric address or explicit verification
  if (!hasNumericAddress && !explicitlyVerified) return true;

  return false;
}

/**
 * Curated allowlist mirroring the server's INLINE_FALLBACK_WELLNESS so a
 * known-real venue is treated as verified even without a numeric address.
 */
export const WELLNESS_VENUE_ALLOWLIST: Set<string> = new Set([
  'spa valmont at le meurice',
  'spa my blend by clarins',
  'hammam pacha',
  'cristallo spa at palazzo manfredi',
  'acquamadre hammam',
  'vabali spa berlin',
  'liquidrom',
  'aire ancient baths',
  'spa mayan secret at hotel claris',
  'espa life at corinthia',
  'akasha holistic wellbeing at hotel café royal',
  'aire ancient baths london',
  'six senses spa at tivoli avenida liberdade',
  'spa at bairro alto hotel',
]);

export const WELLNESS_PLACEHOLDER_FALLBACK = 'Spa Time — find a venue';
