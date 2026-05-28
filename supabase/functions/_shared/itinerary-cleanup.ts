// Itinerary Cleanup — Phase 5 boundary (the named "intelligence layer #2").
//
// Pure, deterministic, no LLM, no network. Takes the post-Filler activity list
// for one day and runs an explicit ordered pass that decides "salvage vs drop":
//   1. Chronological sort (stable)
//   2. Collapse adjacent same-category dining rows (breakfast+breakfast → keep one)
//   3. Drop rows whose category contradicts the slot (nightcap in breakfast slot)
//   4. Drop rows whose venue is in the wrong city (uses caller-supplied matcher)
//   5. Drop rows that violate transit distance from prev/next anchor
//      (>20m walk on luxury/luminary/splurge/premium, >30m otherwise)
//   6. Return { activities, needsRefill } — the Refill LLM owns step 6.
//
// Locked / user / manual / extracted / pinned / booked rows are NEVER dropped.
//
// Replaces the salvage logic scattered across nuclearDiningStrip,
// pruneOrphanTransits, vibe-clash mutate, and the various category coherence
// checks. Those guards remain enabled as safety nets while this rolls out.

import type { AdapterActivity } from './skeleton-to-activities.ts';

export type CleanupReason =
  | 'duplicate_meal_slot'
  | 'category_slot_mismatch'
  | 'cross_city_venue'
  | 'transit_too_far'
  | 'inverted_time_window';

export interface NeedsRefillEntry {
  slotId: string;
  slotType: string;
  mealType?: string;
  timeWindow: { startTime: string; endTime: string } | null;
  neighborhood?: string;
  reason: CleanupReason;
  droppedTitle?: string;
}

export interface CleanupResult {
  activities: AdapterActivity[];
  needsRefill: NeedsRefillEntry[];
  ops: Record<CleanupReason, number>;
}

export interface CleanupOptions {
  /** 'luxury' | 'luminary' | 'splurge' | 'premium' enables tighter walk thresholds. */
  budgetTier?: string | null;
  /** Caller-supplied cross-city test. Returns true when venue is in a different city. */
  isCrossCityVenue?: (activity: AdapterActivity) => boolean;
  /** Optional: meters between two activities. Returns null when unknown (no drop). */
  distanceMeters?: (a: AdapterActivity, b: AdapterActivity) => number | null;
}

const LUXURY_TIERS = new Set(['luxury', 'luminary', 'splurge', 'premium']);
const MEAL_CATEGORIES = new Set(['breakfast', 'brunch', 'lunch', 'dinner', 'meal', 'dining']);

function isExempt(a: AdapterActivity): boolean {
  if (a.isLocked) return true;
  const src = (a.source ?? '').toLowerCase();
  if (src === 'user' || src === 'manual' || src === 'extracted' || src === 'pinned' || src === 'booked' || src === 'imported') {
    return true;
  }
  return false;
}

function chronoKey(a: AdapterActivity): number {
  const t = (a.startTime || '00:00').split(':');
  const h = Number(t[0]) || 0;
  const m = Number(t[1]) || 0;
  // Late-nightlife bookend wrap: treat pre-dawn hours as belonging to the tail
  if (h < 6) return (h + 24) * 60 + m;
  return h * 60 + m;
}

function walkThresholdMeters(tier?: string | null): number {
  if (tier && LUXURY_TIERS.has(tier.toLowerCase())) return 1000;
  return 1500;
}

function categoryMatchesSlot(activity: AdapterActivity): { ok: boolean; reason?: CleanupReason } {
  const slotType = String(activity.metadata.skeletonSlotType ?? '');
  const mealType = String(activity.metadata.mealType ?? '');
  const cat = (activity.category ?? '').toLowerCase();
  const title = (activity.title ?? '').toLowerCase();

  // Nightcap / cocktail / bar in a breakfast or brunch slot
  if (slotType === 'meal' && (mealType === 'breakfast' || mealType === 'brunch')) {
    if (/\b(nightcap|cocktail|aperitif|bar crawl|speakeasy)\b/.test(title)) {
      return { ok: false, reason: 'category_slot_mismatch' };
    }
  }
  // Meal slot must produce a meal-ish category
  if (slotType === 'meal' && cat && !MEAL_CATEGORIES.has(cat) && !MEAL_CATEGORIES.has(mealType)) {
    return { ok: false, reason: 'category_slot_mismatch' };
  }
  return { ok: true };
}

function timeWindowOf(a: AdapterActivity): { startTime: string; endTime: string } | null {
  if (!a.startTime || !a.endTime) return null;
  return { startTime: a.startTime, endTime: a.endTime };
}

function makeRefillEntry(a: AdapterActivity, reason: CleanupReason): NeedsRefillEntry {
  return {
    slotId: String(a.metadata.skeletonSlotId ?? a.id),
    slotType: String(a.metadata.skeletonSlotType ?? 'activity'),
    mealType: a.metadata.mealType ? String(a.metadata.mealType) : undefined,
    timeWindow: timeWindowOf(a),
    neighborhood: a.location,
    reason,
    droppedTitle: a.title,
  };
}

export function cleanupDay(input: AdapterActivity[], opts: CleanupOptions = {}): CleanupResult {
  const ops: Record<CleanupReason, number> = {
    duplicate_meal_slot: 0,
    category_slot_mismatch: 0,
    cross_city_venue: 0,
    transit_too_far: 0,
    inverted_time_window: 0,
  };
  const needsRefill: NeedsRefillEntry[] = [];

  // Step 1 — stable chronological sort
  const sorted = [...input].sort((a, b) => {
    const d = chronoKey(a) - chronoKey(b);
    if (d !== 0) return d;
    const pa = Number(a.metadata?.position ?? 0);
    const pb = Number(b.metadata?.position ?? 0);
    return pa - pb;
  });

  // Step 1b — drop inverted time windows (endTime < startTime, not a midnight wrap)
  let working = sorted.filter((a) => {
    if (isExempt(a)) return true;
    if (!a.startTime || !a.endTime) return true;
    const s = chronoKey({ ...a, startTime: a.startTime } as AdapterActivity);
    const e = chronoKey({ ...a, startTime: a.endTime } as AdapterActivity);
    if (e < s && !(a.startTime >= '22:00' && a.endTime < '06:00')) {
      ops.inverted_time_window++;
      needsRefill.push(makeRefillEntry(a, 'inverted_time_window'));
      return false;
    }
    return true;
  });

  // Step 2 — collapse adjacent same-mealType / same-category rows (keep first non-exempt or exempt)
  const collapsed: AdapterActivity[] = [];
  for (const a of working) {
    const prev = collapsed[collapsed.length - 1];
    if (!prev) { collapsed.push(a); continue; }
    const prevMeal = String(prev.metadata.mealType ?? prev.category ?? '');
    const aMeal = String(a.metadata.mealType ?? a.category ?? '');
    const isAdjacentMeal =
      MEAL_CATEGORIES.has(prevMeal.toLowerCase()) &&
      prevMeal.toLowerCase() === aMeal.toLowerCase();
    if (isAdjacentMeal && !isExempt(a)) {
      ops.duplicate_meal_slot++;
      needsRefill.push(makeRefillEntry(a, 'duplicate_meal_slot'));
      continue;
    }
    if (isAdjacentMeal && !isExempt(prev) && isExempt(a)) {
      // exempt wins — drop the previous (rare path)
      collapsed.pop();
      ops.duplicate_meal_slot++;
      needsRefill.push(makeRefillEntry(prev, 'duplicate_meal_slot'));
      collapsed.push(a);
      continue;
    }
    collapsed.push(a);
  }
  working = collapsed;

  // Step 3 — category vs slot mismatch
  working = working.filter((a) => {
    if (isExempt(a)) return true;
    const check = categoryMatchesSlot(a);
    if (!check.ok && check.reason) {
      ops[check.reason]++;
      needsRefill.push(makeRefillEntry(a, check.reason));
      return false;
    }
    return true;
  });

  // Step 4 — cross-city venue
  if (opts.isCrossCityVenue) {
    working = working.filter((a) => {
      if (isExempt(a)) return true;
      if (opts.isCrossCityVenue!(a)) {
        ops.cross_city_venue++;
        needsRefill.push(makeRefillEntry(a, 'cross_city_venue'));
        return false;
      }
      return true;
    });
  }

  // Step 5 — transit-too-far check vs prev/next NON-exempt anchor
  if (opts.distanceMeters) {
    const threshold = walkThresholdMeters(opts.budgetTier);
    const survivors: AdapterActivity[] = [];
    for (let i = 0; i < working.length; i++) {
      const a = working[i];
      if (isExempt(a)) { survivors.push(a); continue; }
      const prev = survivors[survivors.length - 1];
      const next = working[i + 1];
      let drop = false;
      for (const neighbour of [prev, next]) {
        if (!neighbour) continue;
        const d = opts.distanceMeters!(neighbour, a);
        if (d == null) continue;
        if (d > threshold) { drop = true; break; }
      }
      if (drop) {
        ops.transit_too_far++;
        needsRefill.push(makeRefillEntry(a, 'transit_too_far'));
        continue;
      }
      survivors.push(a);
    }
    working = survivors;
  }

  return { activities: working, needsRefill, ops };
}
