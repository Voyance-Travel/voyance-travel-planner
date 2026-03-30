/**
 * Shared accommodation activity helpers.
 * 
 * Provides intent-aware detection and deduplication for hotel/accommodation
 * activities across the frontend (regeneration, rewrite, chat actions).
 */

export type AccommodationIntent = 'check_in' | 'checkout' | 'freshen_up' | 'return' | 'generic';

const CHECK_IN_RE = /\bcheck[\s-]?in\b/i;
const CHECKOUT_RE = /\bcheck[\s-]?out\b/i;
const FRESHEN_RE = /\bfreshen\s*up\b/i;
const RETURN_RE = /\breturn\s+to\b/i;
const SETTLE_RE = /\bsettle\s+in\b/i;
const BACK_RE = /\bback\s+to\b.*\bhotel\b/i;

const ACCOM_CATEGORIES = ['accommodation', 'hotel', 'stay'];

/** Determine the intent of an accommodation activity */
export function getAccommodationIntent(title: string, category?: string): AccommodationIntent | null {
  const cat = (category || '').toLowerCase();
  const t = (title || '').toLowerCase();

  const isAccom = ACCOM_CATEGORIES.includes(cat) ||
    t.includes('hotel') || t.includes('check-in') || t.includes('checkout') ||
    t.includes('check in') || t.includes('check out') || t.includes('freshen up') ||
    t.includes('settle in') || t.includes('return to');

  if (!isAccom) return null;

  if (CHECKOUT_RE.test(t)) return 'checkout';
  if (FRESHEN_RE.test(t)) return 'freshen_up';
  if (RETURN_RE.test(t) || BACK_RE.test(t)) return 'return';
  if (CHECK_IN_RE.test(t) || SETTLE_RE.test(t)) return 'check_in';
  return 'generic';
}

/** Check if an activity is accommodation-related */
export function isAccommodationLike(activity: { title?: string; name?: string; category?: string }): boolean {
  return getAccommodationIntent(activity.title || activity.name || '', activity.category) !== null;
}

/**
 * Merge accommodation activities from a regenerated day with originals.
 * 
 * Strategy: preserve distinct intents (check-in, freshen-up, return, checkout).
 * For each intent, prefer the original if it exists; otherwise keep the new one.
 * This prevents collapsing multiple valid hotel cards into one.
 */
export function mergeAccommodationActivities<T extends { title?: string; name?: string; category?: string; startTime?: string; time?: string }>(
  originalActivities: T[],
  newActivities: T[],
): T[] {
  const origByIntent = new Map<AccommodationIntent, T>();
  const newByIntent = new Map<AccommodationIntent, T[]>();

  // Catalog original accommodation cards by intent
  for (const act of originalActivities) {
    const intent = getAccommodationIntent(act.title || act.name || '', act.category);
    if (intent) origByIntent.set(intent, act);
  }

  // Catalog new accommodation cards by intent
  for (const act of newActivities) {
    const intent = getAccommodationIntent(act.title || act.name || '', act.category);
    if (intent) {
      const list = newByIntent.get(intent) || [];
      list.push(act);
      newByIntent.set(intent, list);
    }
  }

  // Remove ALL accommodation cards from new activities
  const nonAccom = newActivities.filter(a => !isAccommodationLike(a));

  // Re-insert: for each intent found in either set, prefer original
  const toInsert: T[] = [];
  const seenIntents = new Set<AccommodationIntent>();

  for (const [intent, orig] of origByIntent) {
    toInsert.push(orig);
    seenIntents.add(intent);
  }

  // Add new intents not covered by originals
  for (const [intent, acts] of newByIntent) {
    if (!seenIntents.has(intent) && acts.length > 0) {
      toInsert.push(acts[0]); // keep first of each new intent
      seenIntents.add(intent);
    }
  }

  // Merge and sort
  const merged = [...nonAccom, ...toInsert];
  merged.sort((a, b) =>
    (a.startTime || a.time || '').localeCompare(b.startTime || b.time || '')
  );

  return merged;
}
