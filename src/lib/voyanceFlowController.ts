/**
 * ============================================================================
 * VOYANCE FLOW CONTROLLER — Single Source of Truth
 * ============================================================================
 *
 * Every file that needs to calculate costs, check user access, decide
 * generation mode, or track action limits MUST import from this file.
 *
 * Constants are RE-EXPORTED from their canonical sources (config/pricing.ts
 * and tripCostCalculator.ts) — never duplicated.
 *
 * Edge functions (Deno) cannot import from src/. Their copies of constants
 * must be kept in sync manually — see get-entitlements/index.ts.
 * ============================================================================
 */

// ── Re-exports from canonical sources ───────────────────────────────────────
export {
  CREDIT_COSTS,
  TIER_FREE_CAPS,
  FREE_ACTION_CAPS,
  FLEX_CAPS_BY_DAYS,
  SIGNUP_CREDITS,
  ROUTE_OPT_STANDARD_SCHEDULE,
  ROUTE_OPT_CLUB_SCHEDULE,
  type UserTier,
  type TierCaps,
} from '@/config/pricing';

export {
  BASE_RATE_PER_DAY,
  calculateTripCredits,
} from '@/lib/tripCostCalculator';

import { CREDIT_COSTS, TIER_FREE_CAPS, FLEX_CAPS_BY_DAYS, ROUTE_OPT_STANDARD_SCHEDULE, ROUTE_OPT_CLUB_SCHEDULE, type UserTier, type TierCaps } from '@/config/pricing';

// ── Constants ───────────────────────────────────────────────────────────────

// GUARD: First-trip users get exactly 2 days free. Day 3+ is gated.
// This value is used by canAccessDay() and computeUnlockedDayCount().
// Changing this number affects all first-trip users — coordinate with pricing.ts if adjusted.
export const FIRST_TRIP_FREE_DAYS = 2;

// ── Types ───────────────────────────────────────────────────────────────────

type CappedAction = 'swap_activity' | 'regenerate_day' | 'ai_message' | 'restaurant_rec' | 'transport_mode_change';

export interface DayAccessResult {
  canAccess: boolean;
  reason: 'smart_finish' | 'unlocked' | 'first_trip_free' | 'gated';
  unlockCost: number;
}

export interface ActionCostResult {
  isFree: boolean;
  cost: number;
  usedCount: number;
  freeRemaining: number;
  cap: number;
}

// ── Section: Day Access (Gating) ────────────────────────────────────────────

/**
 * THE master function for per-day premium content access.
 *
 * Premium content = photos, addresses, tips, reviews, booking links.
 *
 * Used by: useEntitlements.ts → canViewPremiumContentForDay()
 */
export function canAccessDay(
  dayNumber: number,
  unlockedDayCount: number,
  isFirstTrip: boolean,
  hasSmartFinish: boolean,
): DayAccessResult {
  if (hasSmartFinish) {
    return { canAccess: true, reason: 'smart_finish', unlockCost: 0 };
  }
  if (dayNumber <= unlockedDayCount) {
    return { canAccess: true, reason: 'unlocked', unlockCost: 0 };
  }
  // First-trip-free: users get Days 1-2 at no cost. Day 3+ requires unlock or Smart Finish.
  if (isFirstTrip && dayNumber <= FIRST_TRIP_FREE_DAYS) {
    return { canAccess: true, reason: 'first_trip_free', unlockCost: 0 };
  }
  return { canAccess: false, reason: 'gated', unlockCost: CREDIT_COSTS.UNLOCK_DAY };
}

/** Simple boolean shorthand */
export function canAccessDaySimple(
  dayNumber: number,
  unlockedDayCount: number,
  isFirstTrip: boolean,
  hasSmartFinish: boolean,
): boolean {
  return canAccessDay(dayNumber, unlockedDayCount, isFirstTrip, hasSmartFinish).canAccess;
}

// ── Section: Unlocked Day Count ─────────────────────────────────────────────

/**
 * Computes the unlocked_day_count to persist after generation completes.
 *
 * THE only function that should decide this value.
 * Used by: TripDetail.tsx handleGenerationComplete
 *
 * The edge function (save-itinerary) must NOT set unlocked_day_count.
 */
export function computeUnlockedDayCount(params: {
  isFirstTrip: boolean;
  isPreview: boolean;
  generatedDayCount: number;
}): number {
  // Preview users get Day 1 free so they can evaluate the trip before committing credits.
  if (params.isPreview) return 1;
  if (params.isFirstTrip) return Math.min(FIRST_TRIP_FREE_DAYS, params.generatedDayCount);
  return params.generatedDayCount;
}

/**
 * New count after a single-day unlock (increment by 1).
 * Used by: useUnlockDay.ts
 */
export function getUnlockedDayCountAfterUnlock(currentCount: number): number {
  return currentCount + 1;
}

// ── Section: Action Costs ───────────────────────────────────────────────────

const ACTION_TO_COST_KEY: Record<CappedAction, keyof typeof CREDIT_COSTS> = {
  swap_activity: 'SWAP_ACTIVITY',
  regenerate_day: 'REGENERATE_DAY',
  ai_message: 'AI_MESSAGE',
  restaurant_rec: 'RESTAURANT_REC',
  transport_mode_change: 'TRANSPORT_MODE_CHANGE',
};

const ACTION_TO_CAP_KEY: Record<CappedAction, keyof TierCaps> = {
  swap_activity: 'swaps',
  regenerate_day: 'regenerates',
  ai_message: 'ai_messages',
  restaurant_rec: 'restaurant_recs',
  // transport_mode_change has no free cap — always paid
  transport_mode_change: 'swaps', // unused fallback; cap forced to 0 below
};

/**
 * THE master function for per-action cost checks.
 *
 * Returns whether the next use is free (within per-trip cap) or costs credits.
 *
 * Used by: useActionCap.ts, spend-credits toast display
 */
export function getActionCost(
  actionType: CappedAction,
  usedCount: number,
  tier: UserTier = 'free',
): ActionCostResult {
  const creditCost = CREDIT_COSTS[ACTION_TO_COST_KEY[actionType]];

  // transport_mode_change has no free cap
  if (actionType === 'transport_mode_change') {
    return { isFree: false, cost: creditCost, usedCount, freeRemaining: 0, cap: 0 };
  }

  const caps = TIER_FREE_CAPS[tier] ?? TIER_FREE_CAPS.free;
  const capKey = ACTION_TO_CAP_KEY[actionType];
  const cap = caps[capKey];
  const freeRemaining = Math.max(0, cap - usedCount);
  const isFree = freeRemaining > 0;

  return {
    isFree,
    cost: isFree ? 0 : creditCost,
    usedCount,
    freeRemaining,
    cap,
  };
}

// ── Section: Trip-level Access ──────────────────────────────────────────────

/**
 * Per-trip paid access check.
 *
 * EXCLUDES the global hasCompletedPurchase flag — access is per-trip only.
 *
 * Used by: get-entitlements edge function (hasPaidAccess line)
 */
export function hasPaidAccessForTrip(params: {
  tripHasSmartFinish: boolean;
  unlockedDays: number;
}): boolean {
  return params.tripHasSmartFinish || params.unlockedDays > 0;
}

// ── Section: Toast Formatting ───────────────────────────────────────────────

/**
 * Formats a human-readable toast for a capped action result.
 */
export function formatActionToast(
  actionLabel: string,
  result: ActionCostResult,
): string {
  if (result.isFree) {
    const remaining = result.freeRemaining - 1; // after this use
    return `${actionLabel} (free, ${remaining} remaining)`;
  }
  return `${actionLabel} (${result.cost} credits used)`;
}

// ── Section: Smart Finish Comparison ────────────────────────────────────────

/**
 * Compare the cost of unlocking remaining gated days individually vs Smart Finish.
 * Returns the comparison so the UI can nudge users toward the better deal.
 */
export function getSmartFinishComparison(params: {
  totalDays: number;
  unlockedDayCount: number;
  hasSmartFinish: boolean;
}): {
  remainingDays: number;
  individualCost: number;
  smartFinishCost: number;
  savings: number;
  smartFinishIsCheaper: boolean;
} {
  if (params.hasSmartFinish) {
    return {
      remainingDays: 0,
      individualCost: 0,
      smartFinishCost: 0,
      savings: 0,
      smartFinishIsCheaper: false,
    };
  }

  const remainingDays = Math.max(0, params.totalDays - params.unlockedDayCount);
  const individualCost = remainingDays * CREDIT_COSTS.UNLOCK_DAY;
  const smartFinishCost = CREDIT_COSTS.SMART_FINISH;
  const savings = individualCost - smartFinishCost;

  return {
    remainingDays,
    individualCost,
    smartFinishCost,
    savings,
    smartFinishIsCheaper: savings > 0,
  };
}

// ── Section: Route Optimization Cost ────────────────────────────────────────

/**
 * Returns the credit cost for route optimization based on how many times
 * this trip has already been optimized and the user's tier.
 *
 * Standard: [20, 15, 10, 5 (floor)]
 * Club:     [10, 8, 6, 3 (floor)]
 *
 * optimizeCount = number of *completed* optimizations for this trip (0 = first time).
 */
export function getRouteOptimizationCost(optimizeCount: number, tier: UserTier = 'free'): number {
  const isClub = ['voyager', 'explorer', 'adventurer'].includes(tier);
  const schedule = isClub ? ROUTE_OPT_CLUB_SCHEDULE : ROUTE_OPT_STANDARD_SCHEDULE;
  const floor = schedule[schedule.length - 1];
  if (optimizeCount >= schedule.length) return floor;
  return schedule[optimizeCount];
}
