/**
 * Itinerary completeness classifier (frontend mirror of the backend gate in
 * supabase/functions/generate-itinerary/day-validation.ts → classifyItineraryCompleteness).
 *
 * Used to decide whether a saved trip should be treated as a real itinerary
 * or a degenerate hotel-only / shell-day output. Keeps the regeneration UI,
 * recovery banner, and downstream gating in lockstep with what the backend
 * marks as 'failed' / 'incomplete_itinerary'.
 */

const NON_MEANINGFUL_CATS = new Set([
  'hotel', 'accommodation', 'lodging', 'stay', 'flight', 'flights',
  'check-in', 'check-out', 'checkin', 'checkout', 'bag-drop', 'bag drop',
  'departure', 'arrival',
]);

const NON_MEANINGFUL_TITLE_RE =
  /\b(check\s*-?\s*in|check\s*-?\s*out|bag\s*-?\s*drop|return\s+to\s+(?:your\s+)?hotel|hotel\s+checkout|hotel\s+check-?in|airport\s+transfer|departure)\b/i;

interface AnyActivity {
  id?: string;
  title?: string | null;
  name?: string | null;
  category?: string | null;
  type?: string | null;
  isLocked?: boolean;
  cost?: number | { amount?: number } | null;
}

interface AnyDay {
  dayNumber?: number;
  activities?: AnyActivity[] | null;
}

function activityCostCents(a: AnyActivity): number {
  if (typeof a?.cost === 'number' && Number.isFinite(a.cost)) {
    return Math.max(0, Math.round(a.cost * 100));
  }
  if (a?.cost && typeof a.cost === 'object') {
    const amt = (a.cost as { amount?: number }).amount;
    if (typeof amt === 'number' && Number.isFinite(amt)) {
      return Math.max(0, Math.round(amt * 100));
    }
  }
  return 0;
}

function isMeaningful(a: AnyActivity): boolean {
  const cat = `${a?.category || ''} ${a?.type || ''}`.toLowerCase().trim();
  for (const c of NON_MEANINGFUL_CATS) {
    if (cat.includes(c)) return false;
  }
  const title = String(a?.title || a?.name || '').trim();
  if (!title) return false;
  if (NON_MEANINGFUL_TITLE_RE.test(title)) return false;
  return true;
}

export type ItineraryCompletenessStatus = 'ok' | 'empty' | 'incomplete';

export interface ItineraryCompletenessResult {
  status: ItineraryCompletenessStatus;
  meaningfulCount: number;
  paidMeaningfulCount: number;
  dayCount: number;
}

/**
 * Mirror of the backend gate — see day-validation.ts.
 * - 'empty'      → no meaningful (non-hotel/flight/logistics) activity at all
 * - 'incomplete' → multi-day trip with ≤1 paid meaningful activity (hotel-only
 *                  or hotel + a single filler) — Budget Coach must stay paused
 * - 'ok'         → at least one real day of content
 */
export function classifyItineraryCompleteness(
  days: AnyDay[] | null | undefined,
): ItineraryCompletenessResult {
  const list = Array.isArray(days) ? days : [];
  let meaningfulCount = 0;
  let paidMeaningfulCount = 0;
  for (const d of list) {
    for (const a of d?.activities || []) {
      if (!isMeaningful(a)) continue;
      meaningfulCount++;
      if (activityCostCents(a) > 0) paidMeaningfulCount++;
    }
  }
  const dayCount = list.length;
  if (dayCount === 0) {
    return { status: 'ok', meaningfulCount, paidMeaningfulCount, dayCount };
  }
  if (meaningfulCount === 0) {
    return { status: 'empty', meaningfulCount, paidMeaningfulCount, dayCount };
  }
  if (dayCount >= 2 && paidMeaningfulCount <= 1) {
    return { status: 'incomplete', meaningfulCount, paidMeaningfulCount, dayCount };
  }
  return { status: 'ok', meaningfulCount, paidMeaningfulCount, dayCount };
}

/** Convenience: true when generation should be considered failed. */
export function isItineraryDegenerate(
  days: AnyDay[] | null | undefined,
): boolean {
  const r = classifyItineraryCompleteness(days);
  return r.status !== 'ok' && r.dayCount > 0;
}
