/**
 * Canonical Trip Pricing Engine
 * 
 * Single source of truth for computing activity group totals from cost objects.
 * Handles per_person, flat, and per_room basis correctly.
 * 
 * EVERY UI surface and sync path must use these functions to compute costs.
 * Do not manually multiply by travelers elsewhere.
 */

export type CostBasis = 'per_person' | 'flat' | 'per_room';

export interface ActivityCostInput {
  amount?: number;
  total?: number;
  perPerson?: number;
  basis?: CostBasis | string;
  currency?: string;
}

/**
 * Resolve the GROUP TOTAL for a single activity, given its cost object and traveler count.
 * 
 * Rules:
 * - `basis === 'flat'` → amount IS the group total (don't multiply)
 * - `basis === 'per_room'` → amount IS the group total (don't multiply)
 * - `basis === 'per_person'` or unset → amount × travelers
 * - If `total` is provided, use it directly (it's already the group total)
 * 
 * @returns Group total in whole currency units (e.g., dollars, not cents)
 */
export function resolveGroupTotal(
  cost: ActivityCostInput | number | null | undefined,
  travelers: number
): number {
  if (cost == null) return 0;

  // Plain number — assume per_person
  if (typeof cost === 'number') {
    return cost * Math.max(travelers, 1);
  }

  // If `total` is explicitly set, use it (already group total)
  if (cost.total != null && cost.total > 0) {
    return cost.total;
  }

  const amount = cost.amount ?? cost.perPerson ?? 0;
  if (amount <= 0) return 0;

  const basis = (cost.basis || 'per_person') as CostBasis;

  switch (basis) {
    case 'flat':
    case 'per_room':
      return amount;
    case 'per_person':
    default:
      return amount * Math.max(travelers, 1);
  }
}

/**
 * Resolve cost_per_person_usd for writing to the activity_costs table.
 * 
 * The DB view `v_trip_total` computes: cost_per_person_usd × num_travelers.
 * So we must store the per-person portion only.
 * 
 * For flat-rate items, divide by travelers so the view doesn't double-count.
 */
export function resolvePerPersonForDb(
  cost: ActivityCostInput | number | null | undefined,
  travelers: number
): number {
  if (cost == null) return 0;

  if (typeof cost === 'number') {
    // Plain number assumed per_person already
    return cost;
  }

  // If total is explicitly provided, derive per-person from it
  if (cost.total != null && cost.total > 0) {
    return cost.total / Math.max(travelers, 1);
  }

  const amount = cost.amount ?? cost.perPerson ?? 0;
  if (amount <= 0) return 0;

  const basis = (cost.basis || 'per_person') as CostBasis;

  switch (basis) {
    case 'flat':
    case 'per_room':
      return amount / Math.max(travelers, 1);
    case 'per_person':
    default:
      return amount;
  }
}

/**
 * Resolve the original category from an activity's type/category fields.
 * Preserves dining/transport categories instead of defaulting to 'activity'.
 */
export function resolveCategory(
  category?: string,
  type?: string
): string {
  const raw = (category || type || 'activity').toLowerCase();

  // Map common variants to canonical categories
  if (['dining', 'restaurant', 'food', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee'].includes(raw)) {
    return 'dining';
  }
  if (['transport', 'transfer', 'transit', 'taxi', 'uber', 'rideshare', 'airport'].includes(raw)) {
    return 'transport';
  }
  if (['nightlife', 'bar', 'club', 'lounge'].includes(raw)) {
    return 'nightlife';
  }
  if (['sightseeing', 'attraction', 'museum', 'gallery', 'tour', 'experience'].includes(raw)) {
    return 'activity';
  }

  return raw;
}

/**
 * Sum group totals for all activities in an itinerary.
 * Returns total in whole currency units.
 */
export function computeItineraryTotal(
  days: Array<{
    activities: Array<{
      cost?: ActivityCostInput | number | null;
    }>;
  }>,
  travelers: number
): number {
  let total = 0;
  for (const day of days) {
    for (const act of day.activities) {
      total += resolveGroupTotal(act.cost, travelers);
    }
  }
  return total;
}
