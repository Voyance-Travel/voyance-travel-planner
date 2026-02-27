/**
 * City Normalization Utility
 * Single source of truth for extracting and normalizing multi-city data
 * from chat planner details. Used by both TripChatPlanner (UI) and Start.tsx (persistence).
 */

import { differenceInDays } from 'date-fns';
import logger from '@/lib/logger';

export interface NormalizedCity {
  name: string;
  country?: string;
  nights: number;
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
    cities?: Array<{ name: string; country?: string; nights?: number }>;
    destination?: string;
    additionalNotes?: string;
    startDate?: string;
    endDate?: string;
  },
  startDate: Date,
  endDate: Date,
): NormalizedCity[] {
  const totalNights = Math.max(1, differenceInDays(endDate, startDate));

  // ── 1. Authoritative: AI-populated cities[] ──
  const rawCities = Array.isArray(details?.cities) ? details.cities : [];

  if (rawCities.length > 1) {
    const normalized = rawCities
      .map((c) => ({
        name: cleanCandidate(String(c?.name || '')),
        country: c?.country ? String(c.country) : undefined,
        nights: Number(c?.nights),
      }))
      .filter((c) => c.name.length > 1);

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
      }));
    }
  }

  // ── 2. Fallback: parse from destination / notes strings ──
  const destination = String(details?.destination || '');
  const notes = String(details?.additionalNotes || '');

  const candidates: string[] = [];

  // Try destination first
  if (SEPARATOR_PATTERN.test(destination) || WEAK_SEPARATOR_PATTERN.test(destination)) {
    const parts = destination
      .split(WEAK_SEPARATOR_PATTERN)
      .map(cleanCandidate)
      .filter((p) => p.length > 1 && p.length < 50 && !/^\d+$/.test(p));

    if (parts.length > 2 || SEPARATOR_PATTERN.test(destination)) {
      // Strong signal or 3+ parts — accept
      candidates.push(...parts);
    } else if (parts.length === 2) {
      // Two parts from weak separator — guard against "City, Country"
      const second = parts[1].toLowerCase();
      if (!COUNTRY_HINTS.has(second)) {
        candidates.push(...parts);
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
      .filter((p) => p.length > 1 && p.length < 50 && !/^\d+$/.test(p));

    if (parts.length > 1) {
      candidates.push(...parts);
    }
  }

  // De-duplicate (case-insensitive)
  const deduped = Array.from(
    new Map(candidates.map((n) => [n.toLowerCase(), n])).values(),
  );

  if (deduped.length <= 1) {
    logger.debug('[cityNormalization] Single city detected');
    return [];
  }

  const result = distributeNights(deduped, totalNights);
  logger.info('[cityNormalization] Fallback parsed cities', result);
  return result;
}
