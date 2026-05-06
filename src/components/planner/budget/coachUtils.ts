/**
 * Shared rules for "is this activity something the Budget Coach can act on?"
 *
 * Used by both BudgetCoach (to decide whether to call the AI / render) and
 * BudgetTab (to decide whether to render the Coach at all). Keeping them in
 * one file guarantees the two surfaces never disagree — the bug we're fixing
 * was exactly that disagreement: BudgetCoach skipped the AI call but its
 * outer shell still rendered against a hotel-only itinerary, surfacing
 * what looked like phantom recommendations.
 *
 * Mirror of the server-side rules in
 *   supabase/functions/budget-coach/index.ts and
 *   supabase/functions/generate-itinerary/day-validation.ts
 */

import { classifyItineraryCompleteness } from '@/utils/itineraryCompleteness';

export interface CoachActivity {
  id?: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  type?: string | null;
  isLocked?: boolean;
  cost?: number | { amount?: number } | null;
}

export interface CoachDay {
  dayNumber?: number;
  activities?: CoachActivity[];
}

const NON_SUGGESTABLE_CATS = new Set([
  'hotel', 'accommodation', 'lodging', 'stay', 'flight', 'flights',
  'check-in', 'check-out', 'checkin', 'checkout', 'bag-drop', 'bag drop',
  'departure', 'arrival',
]);

const NON_SUGGESTABLE_TITLE_RE =
  /\b(check\s*-?\s*in|check\s*-?\s*out|bag\s*-?\s*drop|return\s+to\s+(?:your\s+)?hotel|back\s+to\s+(?:your\s+)?hotel|freshen\s*up\s+at\s+(?:your\s+)?hotel|hotel\s+checkout|hotel\s+check-?in)\b/i;

const GENERIC_TITLE_RE =
  /^(breakfast|lunch|dinner|brunch|meal|activity|activities|transport|transit|hotel|accommodation|untitled|free\s+time|explore\s+the\s+neighborhood)\s*(\(|-|–|—|$)/i;

export function isGenericCoachTitle(t?: string | null): boolean {
  const s = (t || '').trim();
  if (!s) return true;
  if (/^(activity|untitled|tbd|n\/a|free\s+time)$/i.test(s)) return true;
  return GENERIC_TITLE_RE.test(s);
}

export function activityCostCents(a: CoachActivity): number {
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

/**
 * True when an activity is a real, paid, non-locked, non-logistics row that
 * the Coach could legitimately propose a swap or drop for.
 */
export function isSuggestableActivity(a: CoachActivity): boolean {
  if (!a?.id) return false;
  if (a.isLocked) return false;
  const cat = `${a.category || ''} ${a.type || ''}`.toLowerCase().trim();
  for (const c of NON_SUGGESTABLE_CATS) {
    if (cat.includes(c)) return false;
  }
  const title = (a.title || a.name || '').trim();
  if (NON_SUGGESTABLE_TITLE_RE.test(title)) return false;
  if (isGenericCoachTitle(title)) return false;
  if (activityCostCents(a) <= 0) return false;
  return true;
}

/**
 * True when ANY day in the itinerary has at least one suggestable activity.
 * When false, the Budget Coach should not render at all — there is nothing
 * to coach and any chrome the Coach renders will read as a phantom suggestion.
 */
export function hasSuggestableContent(days: CoachDay[] | null | undefined): boolean {
  if (!Array.isArray(days)) return false;
  for (const d of days) {
    const acts = Array.isArray(d?.activities) ? d.activities : [];
    for (const a of acts) {
      if (isSuggestableActivity(a)) return true;
    }
  }
  return false;
}

/**
 * Single source of truth for "should the Budget Coach surface ANY card?".
 * Both the over-budget and under-budget paths must bail on the same rule —
 * historically `hasSuggestableContent` allowed a 2+ day trip with one paid
 * dinner through the gate, even though `classifyItineraryCompleteness`
 * marked the same trip as 'incomplete'. That mismatch is the source of
 * over-budget phantom suggestions on shell-day itineraries.
 */
export interface CoachEligibilityInput {
  days: CoachDay[] | null | undefined;
  tripStatus?: string | null;
  generationFailureReason?: string | null;
}

export function isCoachEligible(input: CoachEligibilityInput): boolean {
  const { days, tripStatus, generationFailureReason } = input;
  if (
    tripStatus === 'failed' &&
    (generationFailureReason === 'empty_itinerary' ||
      generationFailureReason === 'incomplete_itinerary')
  ) {
    return false;
  }
  const completeness = classifyItineraryCompleteness(days as any);
  if (completeness.status !== 'ok') return false;
  return hasSuggestableContent(days);
}

