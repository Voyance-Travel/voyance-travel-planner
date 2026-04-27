/**
 * City Normalization Utility
 * Single source of truth for extracting and normalizing multi-city data
 * from chat planner details. Used by both TripChatPlanner (UI) and Start.tsx (persistence).
 */

import { differenceInDays } from 'date-fns';
import logger from '@/lib/logger';

export type InterCityTransport = 'flight' | 'train' | 'bus' | 'car' | 'ferry';

export interface NormalizedCity {
  name: string;
  country?: string;
  nights: number;
  /** How the traveler arrives at THIS city from the previous one. Undefined for the first city. */
  transportFromPrevious?: InterCityTransport;
}

// Countries / regions that should NOT be treated as a second city
// when split from "City, Country" or "City and Country" patterns
const COUNTRY_HINTS = new Set([
  'usa', 'united states', 'canada', 'mexico', 'uk', 'united kingdom', 'england',
  'scotland', 'wales', 'france', 'italy', 'spain', 'portugal', 'germany', 'austria',
  'switzerland', 'netherlands', 'belgium', 'japan', 'china', 'thailand', 'vietnam',
  'south korea', 'korea', 'australia', 'new zealand', 'greece', 'turkey', 'morocco',
  'egypt', 'uae', 'india', 'indonesia', 'singapore', 'malaysia', 'ireland',
  'czech republic', 'hungary', 'poland', 'brazil', 'argentina', 'colombia',
  'peru', 'chile', 'south africa', 'philippines', 'taiwan', 'hong kong',
]);

// US states & territories that should NOT be treated as standalone cities
const STATE_HINTS = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
  'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
  'new mexico', 'new york state', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina',
  'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia',
  'washington state', 'west virginia', 'wisconsin', 'wyoming',
  'puerto rico', 'guam', 'us virgin islands',
  // Canadian provinces
  'ontario', 'quebec', 'british columbia', 'alberta', 'manitoba',
  'saskatchewan', 'nova scotia', 'new brunswick',
  // Common abbreviations
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id',
  'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms',
  'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok',
  'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv',
  'wi', 'wy',
]);

/** Check if a candidate is a region/state/country rather than a city */
function isRegionNotCity(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return COUNTRY_HINTS.has(lower) || STATE_HINTS.has(lower);
}

/** Descriptive words that indicate a phrase is NOT a city name */
const DESCRIPTIVE_TERMS = new Set([
  'trip', 'focused', 'partying', 'letting', 'vacation', 'adventure',
  'exploring', 'relaxing', 'style', 'vibe', 'itinerary', 'plan',
  'budget', 'experience', 'holiday', 'getaway', 'weekend', 'loose',
  'energy', 'downtime', 'recovery', 'relaxed', 'packed', 'chill',
  'romantic', 'solo', 'group', 'family', 'honeymoon', 'backpacking',
]);

/** Returns true if the candidate looks like a 3-letter IATA airport code */
function looksLikeAirportCode(candidate: string): boolean {
  return /^[A-Z]{3}$/i.test(candidate.trim());
}

/** Returns false if a candidate clearly isn't a city name */
function looksLikeCityName(candidate: string): boolean {
  const words = candidate.trim().split(/\s+/);
  if (words.length >= 6) return false;
  if (looksLikeAirportCode(candidate)) return false;
  return !words.some((w) => DESCRIPTIVE_TERMS.has(w.toLowerCase()));
}

/** Remove filler words, brackets, trailing punctuation from a candidate city name */
function cleanCandidate(value: string): string {
  return value
    .replace(/^route:\s*/i, '')
    .replace(
      /\b(?:flying|fly|into|out\s+of|arrive(?:ing)?|depart(?:ing)?|return(?:ing)?|next|then|visit(?:ing)?|stay(?:ing)?|go(?:ing)?|head(?:ing)?)\b/gi,
      ' ',
    )
    .replace(/[()[\]]/g, ' ')
    .replace(/[.;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Evenly distribute total trip nights across N cities */
function distributeNights(cityNames: string[], totalNights: number): NormalizedCity[] {
  const n = cityNames.length;
  const base = Math.max(1, Math.floor(totalNights / n));
  let remainder = Math.max(0, totalNights - base * n);

  return cityNames.map((name) => {
    const nights = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return { name, nights };
  });
}

/** Strong separator regex for multi-city route detection */
const SEPARATOR_PATTERN = /\s*(?:→|->|–>|=>|\bthen\b)\s*/i;
/** Includes comma and "and" — weaker signals */
const WEAK_SEPARATOR_PATTERN = /\s*(?:→|->|–>|=>|\bthen\b|\band\b|&|,)\s*/i;

/**
 * Resolve a normalized city list from extracted chat details.
 *
 * Priority order:
 *  1. `details.cities` from the AI tool call (authoritative if length > 1)
 *  2. Fallback: parse destination / additionalNotes strings
 *
 * Returns an empty array if only one city is detected (single-city trip).
 */
export function resolveCities(
  details: {
    cities?: Array<{ name: string; country?: string; nights?: number; transportFromPrevious?: string }>;
    destination?: string;
    additionalNotes?: string;
    mustDoActivities?: string;
    startDate?: string;
    endDate?: string;
  },
  startDate: Date,
  endDate: Date,
): NormalizedCity[] {
  const totalNights = Math.max(1, differenceInDays(endDate, startDate));

  // Sniff a transport keyword from any free-text field — used as a backfill
  // when the AI didn't set transportFromPrevious on the cities.
  const freeText = [
    String(details?.destination || ''),
    String(details?.additionalNotes || ''),
    String(details?.mustDoActivities || ''),
  ].join(' ').toLowerCase();
  const sniffTransport = (): InterCityTransport | undefined => {
    if (/\btrain(s|ing)?\b|\brail\b|\beurail\b|\bhigh[- ]?speed rail\b/.test(freeText)) return 'train';
    if (/\bferry|\bferries|\bcruise\b|\bboat\b/.test(freeText)) return 'ferry';
    if (/\bbus(es)?\b|\bcoach\b/.test(freeText)) return 'bus';
    if (/\bdrive|\bdriving\b|\brental car\b|\brent a car\b|\broad trip\b/.test(freeText)) return 'car';
    if (/\bfly(ing)?\b|\bflight(s)?\b|\bplane\b|\bairplane\b/.test(freeText)) return 'flight';
    return undefined;
  };

  const VALID_TRANSPORTS: InterCityTransport[] = ['flight', 'train', 'bus', 'car', 'ferry'];
  const normalizeTransport = (v: unknown): InterCityTransport | undefined => {
    if (!v) return undefined;
    const s = String(v).toLowerCase().trim();
    // Map common synonyms
    const mapped =
      s === 'fly' || s === 'plane' || s === 'airplane' ? 'flight' :
      s === 'rail' ? 'train' :
      s === 'drive' || s === 'driving' || s === 'rental' || s === 'rental car' ? 'car' :
      s === 'coach' ? 'bus' :
      s === 'boat' || s === 'cruise' ? 'ferry' :
      s;
    return (VALID_TRANSPORTS as string[]).includes(mapped) ? (mapped as InterCityTransport) : undefined;
  };

  // ── 1. Authoritative: AI-populated cities[] ──
  const rawCities = Array.isArray(details?.cities) ? details.cities : [];

  if (rawCities.length > 1) {
    const normalized = rawCities
      .map((c) => ({
        name: cleanCandidate(String(c?.name || '')),
        country: c?.country ? String(c.country) : undefined,
        nights: Number(c?.nights),
        transportFromPrevious: normalizeTransport(c?.transportFromPrevious),
      }))
      .filter((c) => c.name.length > 1 && !isRegionNotCity(c.name) && !looksLikeAirportCode(c.name));

    if (normalized.length > 1) {
      const allNightsValid = normalized.every(
        (c) => Number.isFinite(c.nights) && c.nights > 0,
      );
      if (allNightsValid) {
        logger.info('[cityNormalization] Using AI cities[] directly', normalized);
        return normalized.map((c) => ({
          ...c,
          nights: Math.max(1, Math.round(c.nights)),
        }));
      }
      // Nights invalid → redistribute evenly
      const distributed = distributeNights(
        normalized.map((c) => c.name),
        totalNights,
      );
      logger.info('[cityNormalization] AI cities[] with redistributed nights', distributed);
      return distributed.map((c, i) => ({
        ...c,
        country: normalized[i]?.country,
        transportFromPrevious: normalized[i]?.transportFromPrevious,
      }));
    }
  }

  // ── 2. Fallback: parse from destination / notes strings ──
  const destination = String(details?.destination || '');
  const notes = String(details?.additionalNotes || '');

  const candidates: string[] = [];

  // Try destination first — split on any separator
  if (destination) {
    // First try strong separators (→, then, ->)
    if (SEPARATOR_PATTERN.test(destination)) {
      const parts = destination
        .split(SEPARATOR_PATTERN)
        .map(cleanCandidate)
        .filter((p) => p.length > 1 && p.length < 50 && !/^\d+$/.test(p) && looksLikeCityName(p));
      if (parts.length > 1) candidates.push(...parts);
    }
    
    // Then try weak separators (comma, "and", &)
    if (candidates.length <= 1) {
      const weakParts = destination
        .split(WEAK_SEPARATOR_PATTERN)
        .map(cleanCandidate)
        .filter((p) => p.length > 1 && p.length < 50 && !/^\d+$/.test(p) && looksLikeCityName(p));

      if (weakParts.length > 2) {
        // 3+ parts — very likely multi-city even with weak separators
        candidates.length = 0;
        candidates.push(...weakParts);
      } else if (weakParts.length === 2) {
        // Two parts — guard against "City, Country" or "City, State"
        const second = weakParts[1].toLowerCase();
        if (!isRegionNotCity(second)) {
          candidates.length = 0;
          candidates.push(...weakParts);
        }
      }
    }
  }

  // If destination didn't yield multi-city, try notes
  if (candidates.length <= 1 && notes) {
    const routeSegment =
      notes.match(/route:\s*([^\n]+)/i)?.[1] || notes.split(/[.!?\n]/)[0];
    const parts = routeSegment
      .split(WEAK_SEPARATOR_PATTERN)
      .map(cleanCandidate)
      .filter((p) => p.length > 1 && p.length < 50 && !/^\d+$/.test(p) && looksLikeCityName(p));

    if (parts.length > 1) {
      candidates.push(...parts);
    }
  }

  // De-duplicate (case-insensitive) and filter out regions/states
  const deduped = Array.from(
    new Map(candidates.filter(n => !isRegionNotCity(n)).map((n) => [n.toLowerCase(), n])).values(),
  );

  if (deduped.length <= 1) {
    logger.debug('[cityNormalization] Single city detected');
    return [];
  }

  const result = distributeNights(deduped, totalNights);
  logger.info('[cityNormalization] Fallback parsed cities', result);
  return result;
}
