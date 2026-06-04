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

// Meal-slot windows (minutes from midnight) for dedup classification.
const MEAL_SLOT_WINDOWS: Array<[string, number, number]> = [
  ['breakfast', 6 * 60, 11 * 60],   // 06:00–10:59
  ['lunch', 11 * 60, 15 * 60],      // 11:00–14:59
  ['dinner', 17 * 60, 22 * 60 + 1], // 17:00–22:00
];

function parseMinutes(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const p = m[3]?.toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  if (p === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function mealSlotOf(a: any): string | null {
  const mins = parseMinutes(a?.startTime ?? a?.start_time ?? a?.time);
  if (mins === null) return null;
  for (const [slot, lo, hi] of MEAL_SLOT_WINDOWS) if (mins >= lo && mins < hi) return slot;
  return null;
}

/** A meal-guard "find a local spot" placeholder (no resolved venue yet). */
function isSentinelMeal(a: any): boolean {
  const meta = (a?.metadata || {}) as Record<string, unknown>;
  return meta.needsVenuePick === true || meta.preserveAsManualPick === true;
}

function isDiningCard(a: any): boolean {
  return /dining|food|restaurant/i.test(String(a?.category || a?.type || ''));
}

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

/**
 * Collapse REDUNDANT injected meal sentinels so a slot never shows two meals.
 *
 * Side-effect of the protected-meal invariant: a guard injects a "find a local
 * spot" sentinel (which doesn't satisfy meal-detection because it's
 * needsVenuePick), so a later injector still sees the slot as "missing" and
 * adds a SECOND sentinel — and now both are protected, so the dedup that used
 * to delete one can't. This collapses that: per meal slot, if a real
 * (non-sentinel) dining card exists the sentinel is redundant and dropped; if
 * only sentinels exist, keep exactly one. It ONLY ever removes injected
 * sentinels — real/LLM dining cards are never touched (a tapas crawl with two
 * real dinner-time venues is left intact). Mutates `activities` in place;
 * returns the number removed.
 */
export function collapseRedundantInjectedMeals(activities: any[]): number {
  if (!Array.isArray(activities) || activities.length < 2) return 0;

  const sentinelIdxBySlot: Record<string, number[]> = {};
  const realMealInSlot: Record<string, boolean> = {};

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const slot = mealSlotOf(a);
    if (!slot) continue;
    if (isProtectedMeal(a) && isSentinelMeal(a)) {
      (sentinelIdxBySlot[slot] ||= []).push(i);
    } else if (isDiningCard(a) && !isSentinelMeal(a)) {
      realMealInSlot[slot] = true;
    }
  }

  const toRemove = new Set<number>();
  for (const slot of Object.keys(sentinelIdxBySlot)) {
    const idxs = sentinelIdxBySlot[slot];
    if (realMealInSlot[slot]) {
      // A real meal already covers this slot — every injected sentinel is redundant.
      for (const i of idxs) toRemove.add(i);
    } else if (idxs.length > 1) {
      // Only sentinels — keep the first, drop the duplicates.
      for (let k = 1; k < idxs.length; k++) toRemove.add(idxs[k]);
    }
  }

  if (toRemove.size === 0) return 0;
  const kept = activities.filter((_, i) => !toRemove.has(i));
  activities.length = 0;
  activities.push(...kept);
  return toRemove.size;
}
