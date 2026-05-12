/**
 * Dining description backfill — defense in depth for blank "why this place"
 * copy on food cards.
 *
 * Root cause: prior to making `description` required in the LLM schema, the
 * model occasionally omitted it on dining cards. Verified-venue enrichment
 * has no description field to fill from. This helper backfills from:
 *   1. INLINE_FALLBACK_RESTAURANTS (case-insensitive name match for the city)
 *   2. personalization.whyThisFits
 *   3. (no-op — UI fallback handles it)
 *
 * See plan: .lovable/plan.md (Venue descriptions on food cards)
 */
import {
  INLINE_FALLBACK_RESTAURANTS,
  type FallbackRestaurant,
} from '../generate-itinerary/fix-placeholders.ts';
import { stripVenueMealSuffix } from './venue-name.ts';

const DINING_CATEGORIES = new Set([
  'dining',
  'restaurant',
  'food',
  'breakfast',
  'lunch',
  'dinner',
  'brunch',
  'drinks',
]);

const MEAL_TITLE_RE = /^\s*(?:breakfast|brunch|lunch|dinner|drinks)\b/i;

export function isDiningActivity(act: any): boolean {
  if (!act || typeof act !== 'object') return false;
  const cat = String(act.category || '').toLowerCase();
  if (DINING_CATEGORIES.has(cat)) return true;
  const title = typeof act.title === 'string' ? act.title : (act.name || '');
  return MEAL_TITLE_RE.test(title);
}

function cityKey(destinationCity?: string): string | null {
  if (!destinationCity) return null;
  return String(destinationCity).toLowerCase().split(/[,/]/)[0].trim() || null;
}

function extractVenueName(act: any): string | null {
  const candidates = [
    act?.venue_name,
    act?.location?.name,
    typeof act?.title === 'string' ? act.title.replace(/^[^@]*\bat\s+/i, '') : '',
    typeof act?.name === 'string' ? act.name.replace(/^[^@]*\bat\s+/i, '') : '',
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const cleaned = stripVenueMealSuffix(c).trim();
      if (cleaned) return cleaned;
    }
  }
  return null;
}

function findInlineMatch(
  city: string,
  venueName: string,
): FallbackRestaurant | null {
  const dbCity = INLINE_FALLBACK_RESTAURANTS[city];
  if (!dbCity) return null;
  const target = venueName.toLowerCase();
  for (const meal of Object.keys(dbCity)) {
    const list = dbCity[meal];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const n = String(entry.name || '').toLowerCase();
      if (n && (n === target || target.includes(n) || n.includes(target))) {
        if (entry.description) return entry;
      }
    }
  }
  return null;
}

export type BackfillSource = 'fallback' | 'whyThisFits' | 'venueTemplate' | 'noop';

export interface BackfillResult {
  source: BackfillSource;
  changed: boolean;
}

/**
 * Deterministic last-resort dining description.
 *
 * Always returns ≥30 chars with an actionable verb so that:
 *   - the UI never renders an empty dining card body, and
 *   - the description-fill validator (RESTAURANT_RECOMMENDATION_RE) treats
 *     it as "satisfactory" and won't blank it again on the next pass.
 *
 * Style is intentionally venue-aware-but-conservative — never invents dishes,
 * just gives the traveler a concrete next step.
 */
export function buildDeterministicDiningDescription(
  act: any,
  destinationCity?: string,
): string {
  const venueRaw = extractVenueName(act);
  const venue = venueRaw && venueRaw.length > 1 ? venueRaw : null;
  const titleStr = String(act?.title || act?.name || '');
  const mealLabel = /breakfast|brunch/i.test(titleStr) ? 'breakfast'
                  : /lunch/i.test(titleStr) ? 'lunch'
                  : /dinner|supper/i.test(titleStr) ? 'dinner'
                  : /drinks|nightcap|bar|cocktail/i.test(titleStr) ? 'drinks'
                  : 'this stop';
  const cityHint = destinationCity ? ` in ${String(destinationCity).split(/[,/]/)[0].trim()}` : '';

  if (venue) {
    return `Book ahead for ${mealLabel} at ${venue}${cityHint} and ask the staff what's freshest on the menu today.`;
  }
  return `Pick a well-reviewed local spot for ${mealLabel}${cityHint} — book ahead and ask for the day's specials.`;
}

/**
 * In-place backfill of `description` on a single dining activity.
 * Returns the source used (or 'noop' if nothing applied / already populated).
 */
// Templated meal-guard leaks that look "filled" but carry zero insider value.
// Treat as missing so a real fallback / LLM blurb can replace them.
const TEMPLATED_LEAK_RE =
  /(— a real local spot worth visiting|—\s*pick a (?:restaurant|caf[eé]|spot)|^\s*(?:breakfast|brunch|lunch|dinner|drinks|nightcap)\s+at\s+[^.!?]+\.?\s*$)/i;

export function isTemplatedDiningDescription(desc: string): boolean {
  return TEMPLATED_LEAK_RE.test(desc.trim());
}

export function ensureDiningDescription(
  act: any,
  destinationCity?: string,
): BackfillResult {
  if (!isDiningActivity(act)) return { source: 'noop', changed: false };

  const existing =
    typeof act.description === 'string' ? act.description.trim() : '';
  const isTemplatedLeak = existing.length > 0 && isTemplatedDiningDescription(existing);
  if (existing.length >= 20 && !isTemplatedLeak) return { source: 'noop', changed: false };

  const venue = extractVenueName(act);
  const city = cityKey(destinationCity);
  if (city && venue) {
    const hit = findInlineMatch(city, venue);
    if (hit?.description) {
      act.description = hit.description;
      return { source: 'fallback', changed: true };
    }
  }

  const why = act?.personalization?.whyThisFits;
  if (typeof why === 'string' && why.trim().length >= 20) {
    act.description = why.trim();
    return { source: 'whyThisFits', changed: true };
  }

  // Last-resort deterministic template — guarantees a non-empty actionable
  // body so the card never renders blank. Replaces a templated leak too.
  if (existing.length === 0 || isTemplatedLeak) {
    act.description = buildDeterministicDiningDescription(act, destinationCity);
    return { source: 'venueTemplate', changed: true };
  }

  return { source: 'noop', changed: false };
}

export interface DayBackfillCounters {
  fallback: number;
  whyThisFits: number;
  venueTemplate: number;
  scanned: number;
}

export function ensureDayDiningDescriptions(
  activities: any[],
  destinationCity?: string,
): DayBackfillCounters {
  const c: DayBackfillCounters = { fallback: 0, whyThisFits: 0, venueTemplate: 0, scanned: 0 };
  if (!Array.isArray(activities)) return c;
  for (const act of activities) {
    if (!isDiningActivity(act)) continue;
    c.scanned++;
    const r = ensureDiningDescription(act, destinationCity);
    if (r.changed && r.source === 'fallback') c.fallback++;
    else if (r.changed && r.source === 'whyThisFits') c.whyThisFits++;
    else if (r.changed && r.source === 'venueTemplate') c.venueTemplate++;
  }
  return c;
}
