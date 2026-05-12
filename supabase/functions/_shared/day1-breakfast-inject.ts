/**
 * Day-1 breakfast guarantor.
 *
 * Belt-and-braces safety net invoked AFTER `enforceRequiredMealsFinalGuard`
 * on Day 1. Even when meal-policy includes 'breakfast' and the guard runs,
 * we have observed cases where the breakfast slot is still missing because:
 *   - the per-day fallback pool happened to lack breakfast-mealType venues
 *   - the AI relabeled an early "café" as a coffee stop, not a meal slot
 *   - the upstream meal-guard call passed an empty pool on chain-mode partials
 *
 * This helper independently:
 *   1. Verifies dayNumber === 1, breakfast in requiredMeals, arrival < 10:30
 *   2. Re-checks for any breakfast/brunch/cafe card in 06:30–10:30
 *   3. If still missing, builds a breakfast-only fallback pool from
 *      INLINE_FALLBACK_RESTAURANTS + verified_venues (bakery/cafe types)
 *   4. Re-invokes `enforceRequiredMealsFinalGuard` with breakfast-only target
 *
 * Idempotent: returns alreadyCompliant=true (no-op) when breakfast detected.
 *
 * Memory: see plan §1 in .lovable/plan.md and the breakfast guarantor entry.
 */

import { detectCrossCityMention } from './cross-city-filter.ts';

export interface Day1BreakfastInjectInput {
  activities: any[];
  dayNumber: number;
  requiredMeals: string[];
  destination: string;
  arrivalTime24?: string | null;
  /** restaurantPool from upstream context, if any */
  restaurantPool?: Array<{ name: string; address?: string; mealType?: string }>;
  /** Trip-wide already-used restaurant names (cross-day dedup). */
  blockedRestaurants?: string[];
  /** Supabase service-role client for verified_venues lookup. */
  supabase?: any;
}

export interface Day1BreakfastInjectResult {
  injected: boolean;
  reason: string;
  injectedVenue?: string;
  poolSize: number;
}

const BREAKFAST_TITLE_RE = /\b(breakfast|brunch)\b/i;
const BREAKFAST_CATS = new Set(['breakfast', 'brunch', 'cafe', 'bakery']);

function parseTimeMins(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (/pm/i.test(raw) && h < 12) h += 12;
  if (/am/i.test(raw) && h === 12) h = 0;
  return h * 60 + mm;
}

function detectMorningBreakfast(activities: any[]): boolean {
  if (!Array.isArray(activities)) return false;
  for (const a of activities) {
    const title = String(a?.title || a?.name || '');
    const cat = String(a?.category || '').toLowerCase();
    const meal = String(a?.mealSlot || a?.meal_slot || '').toLowerCase();
    const mins = parseTimeMins(a?.startTime || a?.start_time);
    const inWindow = mins == null ? true : mins >= 6 * 60 + 30 && mins <= 10 * 60 + 30;
    const matches =
      meal === 'breakfast' ||
      meal === 'brunch' ||
      BREAKFAST_TITLE_RE.test(title) ||
      BREAKFAST_CATS.has(cat);
    if (matches && inWindow) return true;
  }
  return false;
}

export async function ensureDay1Breakfast(
  input: Day1BreakfastInjectInput,
): Promise<Day1BreakfastInjectResult> {
  const { activities, dayNumber, requiredMeals, destination, arrivalTime24, supabase } = input;

  if (dayNumber !== 1) return { injected: false, reason: 'not_day1', poolSize: 0 };
  if (!Array.isArray(requiredMeals) || !requiredMeals.includes('breakfast')) {
    return { injected: false, reason: 'breakfast_not_required', poolSize: 0 };
  }
  // Skip late arrivals — by policy breakfast already excluded, but guard anyway.
  const arrMins = parseTimeMins(arrivalTime24 || undefined);
  if (arrMins != null && arrMins >= 10 * 60 + 30) {
    return { injected: false, reason: 'late_arrival', poolSize: 0 };
  }
  if (detectMorningBreakfast(activities)) {
    return { injected: false, reason: 'breakfast_already_present', poolSize: 0 };
  }

  // ── Build breakfast-only fallback pool ──────────────────────────────
  const pool: Array<{ name: string; address: string; mealType: string }> = [];
  const seen = new Set<string>();

  // PRIORITY 1: INLINE_FALLBACK_RESTAURANTS breakfast + REGIONAL_EMERGENCY_FALLBACK
  try {
    const fp = await import('../generate-itinerary/fix-placeholders.ts');
    const inline = (fp as any).INLINE_FALLBACK_RESTAURANTS as
      | Record<string, Record<string, Array<{ name: string; address: string }>>>
      | undefined;
    if (inline) {
      const cityKey = (destination || '').toLowerCase().split(',')[0].trim();
      let cityData: Record<string, Array<{ name: string; address: string }>> | undefined;
      for (const [k, v] of Object.entries(inline)) {
        if (cityKey.includes(k) || k.includes(cityKey)) {
          cityData = v;
          break;
        }
      }
      const items = cityData?.breakfast || [];
      for (const r of items) {
        const key = r.name.toLowerCase();
        if (seen.has(key)) continue;
        if (detectCrossCityMention(r.name, destination)) continue;
        if (detectCrossCityMention(r.address || '', destination)) continue;
        seen.add(key);
        pool.push({ name: r.name, address: r.address || destination, mealType: 'breakfast' });
      }
    }
  } catch (_e) { /* non-blocking */ }

  // PRIORITY 2: caller-supplied restaurantPool filtered to breakfast/cafe
  for (const r of input.restaurantPool || []) {
    const meal = String(r.mealType || '').toLowerCase();
    if (meal !== 'breakfast' && meal !== 'brunch' && meal !== 'any' && meal !== 'cafe') continue;
    const key = (r.name || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    if (detectCrossCityMention(r.name, destination)) continue;
    if (detectCrossCityMention(r.address || '', destination)) continue;
    seen.add(key);
    pool.push({ name: r.name, address: r.address || destination, mealType: 'breakfast' });
  }

  // PRIORITY 3: verified_venues (cafe/bakery)
  if (pool.length < 3 && supabase && destination) {
    try {
      const cityOnly = destination.split(',')[0].trim();
      const { data } = await supabase
        .from('verified_venues')
        .select('name, address, category, types')
        .ilike('destination', `%${cityOnly}%`)
        .in('category', ['cafe', 'bakery', 'breakfast', 'restaurant', 'dining'])
        .limit(15);
      if (Array.isArray(data)) {
        for (const v of data) {
          const key = String(v.name || '').toLowerCase();
          if (!key || seen.has(key)) continue;
          if (detectCrossCityMention(v.name, destination)) continue;
          if (detectCrossCityMention(v.address || '', destination)) continue;
          seen.add(key);
          pool.push({ name: v.name, address: v.address || destination, mealType: 'breakfast' });
        }
      }
    } catch (_e) { /* non-blocking */ }
  }

  if (pool.length === 0) {
    console.warn(
      `[DAY1_BREAKFAST_INJECT] day=1 dest="${destination}" SKIP — no breakfast pool resolved (pool=0); meal-guard sentinel will be used`,
    );
    return { injected: false, reason: 'empty_pool', poolSize: 0 };
  }

  // ── Re-invoke the canonical meal guard with breakfast-only target ───
  try {
    const { enforceRequiredMealsFinalGuard } = await import(
      '../generate-itinerary/day-validation.ts'
    );
    const arrFloor = arrMins != null ? Math.max(arrMins, 6 * 60 + 30) : 7 * 60;
    const result = enforceRequiredMealsFinalGuard(
      activities as any,
      ['breakfast'] as any,
      dayNumber,
      destination,
      'USD',
      'morning_arrival',
      pool,
      {
        earliestTimeMins: arrFloor,
        latestTimeMins: 10 * 60 + 45,
        blockedRestaurants: input.blockedRestaurants || [],
      },
    );
    if (result.alreadyCompliant) {
      return { injected: false, reason: 'guard_noop', poolSize: pool.length };
    }
    // Tag the just-injected breakfast cards with our sentinel source.
    const injectedTitle = (() => {
      for (const a of result.activities as any[]) {
        const meal = String(a?.mealSlot || a?.meal_slot || '').toLowerCase();
        const t = String(a?.title || a?.name || '');
        if (meal === 'breakfast' || BREAKFAST_TITLE_RE.test(t)) {
          if (!a.source || /meal[-_]guard|placeholder/i.test(String(a.source))) {
            a.source = 'day1_breakfast_inject';
            a.tags = Array.isArray(a.tags) ? Array.from(new Set([...a.tags, 'day1_breakfast_inject'])) : ['day1_breakfast_inject'];
          }
          return t;
        }
      }
      return undefined;
    })();
    // Mutate caller's array in place to keep the same reference contract as the meal guard.
    activities.length = 0;
    for (const a of result.activities as any[]) activities.push(a);

    console.warn(
      `[DAY1_BREAKFAST_INJECT] day=1 dest="${destination}" venue="${injectedTitle ?? '?'}" pool=${pool.length} arrival=${arrivalTime24 ?? 'unknown'}`,
    );
    return { injected: true, reason: 'injected', injectedVenue: injectedTitle, poolSize: pool.length };
  } catch (e) {
    console.warn(
      `[DAY1_BREAKFAST_INJECT] day=1 dest="${destination}" FAILED: ${e instanceof Error ? e.message : String(e)}`,
    );
    return { injected: false, reason: 'guard_exception', poolSize: pool.length };
  }
}
