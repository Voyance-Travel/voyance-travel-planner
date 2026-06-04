/**
 * Protected-meal invariant — the KEYSTONE of meal coverage.
 *
 * ROOT-CAUSE NOTE (the "Day N missing dinner that keeps coming back" saga):
 * Meal coverage was enforced by INJECTING a meal card, then the day passed
 * through ~37 separate removal/strip/reorder passes (across two functions, six
 * stages, and two storage layers). Almost none of those passes knew the card
 * they were deleting was a guaranteed meal — so whichever pass ran after the
 * latest "final gate" silently stripped the just-injected meal. Moving the
 * gate downstream only relocated the gap; there was always another blind
 * strip pass behind it.
 *
 * The fix is structural, not positional: a required-meal card, once the guard
 * guarantees it, is PROTECTED from removal by every pass. This module is the
 * single source of truth for "is this a protected meal?" and for stamping that
 * protection. Stamping is applied at the single canonical injector
 * (enforceRequiredMealsFinalGuard) so all guard call sites inherit it, plus the
 * save-time meal-persist invariant.
 *
 * Mechanism: we stamp `lock_state = 'locked'` — the system-lock convention
 * already honored by the broad majority of strip/timing passes (the same
 * convention arrival/departure anchor cards use via stamp-*-anchor-truth.ts) —
 * AND an explicit `metadata.protectedMeal` flag for the few deleters that check
 * a different lock variant. A protected meal can still be edited or replaced by
 * the user (user edits override locks); it just cannot be silently deleted by a
 * cleanup pass.
 */

/** Tag the meal guard stamps on every injected dining card. */
export const MEAL_GUARD_TAG = 'meal-guard';

/** Cost sources used by the two meal injectors. */
const PROTECTED_MEAL_COST_SOURCES = new Set([
  'meal_guard_fallback',     // enforceRequiredMealsFinalGuard (day-validation.ts)
  'meal_persist_invariant',  // save-itinerary STEP 2.6 sentinel push
]);

/**
 * Is this activity a guard-guaranteed required meal that must NOT be silently
 * deleted by a cleanup/strip pass? Recognizes the explicit protection flag, the
 * meal-guard tag, and the injector cost-sources — any one is sufficient so the
 * predicate is robust to a card that lost one marker in a downstream rewrite.
 */
export function isProtectedMeal(activity: any): boolean {
  if (!activity || typeof activity !== 'object') return false;
  const meta = (activity.metadata || {}) as Record<string, unknown>;
  if (meta.protectedMeal === true) return true;
  const tags = activity.tags;
  if (Array.isArray(tags) && tags.includes(MEAL_GUARD_TAG)) return true;
  const costSrc = activity.cost && typeof activity.cost === 'object'
    ? (activity.cost as any).source
    : undefined;
  if (typeof costSrc === 'string' && PROTECTED_MEAL_COST_SOURCES.has(costSrc)) return true;
  return false;
}

/**
 * Stamp the protected-meal invariant on a freshly-injected meal card so every
 * downstream pass that honors `lock_state` (timing cascade, schedule
 * executioner, integrity contract, persist validators, …) leaves it in place.
 * Idempotent. Does NOT set `isLocked`/`locked` (the user-lock signals) — this is
 * a SYSTEM guarantee, mirroring how anchor-truth cards are protected.
 */
export function stampMealProtection(activity: any): void {
  if (!activity || typeof activity !== 'object') return;
  activity.lock_state = 'locked';
  activity.metadata = (activity.metadata && typeof activity.metadata === 'object')
    ? activity.metadata
    : {};
  (activity.metadata as Record<string, unknown>).protectedMeal = true;
  // Ensure the meal-guard tag is present so tag-based detectors agree.
  if (!Array.isArray(activity.tags)) activity.tags = [];
  if (!activity.tags.includes(MEAL_GUARD_TAG)) activity.tags.push(MEAL_GUARD_TAG);
}
