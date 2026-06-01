/**
 * tripCostDecomposition — Single source of truth for the Payments-tab bucket
 * sums and their relationship to the headline Trip Total.
 *
 * Composes `resolveCanonicalCostRows` (the resolver shared by snapshot +
 * payable items) plus the misc-reserve contribution and produces:
 *   - displayedTotalCents: matches `useTripFinancialSnapshot.tripTotalCents`
 *     and `useDisplayedTripTotal.snapshotTotalCents` exactly.
 *   - buckets: per-category cents; **invariant** sum(buckets) === displayedTotal
 *     (any unattributed remainder is folded into `misc` so the equation never
 *     drifts visually).
 *   - residualFoldedCents: the signed amount we had to fold into `misc` to
 *     keep the invariant. >$2 in production = a contract bug somewhere
 *     upstream — surfaced via `console.warn` by callers.
 *
 * Closes the Bali "$900 + $480 + $200 = $1,580 vs headline $1,322" pattern:
 *   PaymentsTab used to re-sum bucket totals from `usePayableItems` rows
 *   (which silently drops day-N logistics and double-counts the reserve),
 *   while the headline read from the canonical resolver. There was no
 *   contract tying the two together.
 *
 * Pure & deterministic — no React, no fetches.
 *
 * See mem://constraints/finance/single-cost-decomposition.
 */

import {
  resolveCanonicalCostRows,
  normalizeCanonicalCategory,
  type CanonicalCostInputRow,
  type CanonicalLiveActivity,
  type CanonicalManualPayment,
  type ResolvedRow,
  type ResolveResult,
} from './canonicalCostRows';
import { toBudgetCategory, type BudgetCategoryKey } from './budgetCategoryMap';

export type BucketKey = 'essentials' | 'food' | 'activities' | 'transit' | 'misc';

export interface BucketCents {
  essentials: number;
  food: number;
  activities: number;
  transit: number;
  misc: number;
}

export interface DecompositionResult {
  /** Headline Trip Total in cents — equals snapshot.tripTotalCents. */
  displayedTotalCents: number;
  /** Per-bucket cents. Invariant: sum(buckets) === displayedTotalCents. */
  buckets: BucketCents;
  bucketsSumCents: number;
  /** Signed residual folded into `misc` to maintain the invariant.
   *  |x| > $2 = upstream contract violation; callers should warn. */
  residualFoldedCents: number;
  /** Resolved per-bucket rows for itemization (logistics rows excluded;
   *  hotel/flight surfaced via the dedicated essential rows in PaymentsTab). */
  rowsByBucket: Record<BucketKey, ResolvedRow[]>;
  /** Pass-through resolver result for callers that need the raw breakdown. */
  resolver: ResolveResult;
}

export interface DecomposeArgs {
  costs: CanonicalCostInputRow[];
  liveActivities: CanonicalLiveActivity[];
  manualPayments?: CanonicalManualPayment[];
  includeHotel: boolean;
  includeFlight: boolean;
  travelers?: number;
  /** Misc-reserve contribution computed by `computeMiscReserve` — folded into
   *  the headline by `useTripFinancialSnapshot`. We add the same value here so
   *  the bucket equation matches the headline. */
  miscReserveContributionCents?: number;
}

export interface DecomposeResolvedArgs {
  resolver: ResolveResult;
  includeHotel: boolean;
  includeFlight: boolean;
  /** Misc-reserve contribution computed by `computeMiscReserve` — folded into
   *  the headline by `useTripFinancialSnapshot`. */
  miscReserveContributionCents?: number;
}

/**
 * Map a resolved row's category to a Payments-tab bucket key.
 *
 * Mirrors `toBudgetCategory` but collapses `hotel`/`flight` into a single
 * `essentials` bucket since the Payments tab renders them together.
 */
function bucketForRow(row: ResolvedRow): BucketKey {
  // Hotel/flight rows always live in essentials regardless of where they
  // appear (day-0 logistics OR day-N — both should be counted as essentials
  // in the bucket strip; the row itemization in PaymentsTab still suppresses
  // duplicates against the dedicated hotel/flight rows).
  const cat = (row.category || '').toLowerCase();
  if (cat === 'hotel' || cat === 'accommodation') return 'essentials';
  if (cat === 'flight' || cat === 'flights') return 'essentials';

  // Use the live activity name (when available) so DINING_RE in
  // normalizeCanonicalCategory catches restaurants miscategorised as
  // 'cultural' (Katsukura-style drift). Then map via `toBudgetCategory`.
  const normalized = normalizeCanonicalCategory(cat, row.name || '');
  const mapped: BudgetCategoryKey = toBudgetCategory(normalized || cat);
  switch (mapped) {
    case 'food': return 'food';
    case 'transit': return 'transit';
    case 'misc': return 'misc';
    case 'hotel':
    case 'flight':
      return 'essentials';
    case 'activities':
    default:
      return 'activities';
  }
}

export function decomposeResolvedTripCost(args: DecomposeResolvedArgs): DecompositionResult {
  const resolver = args.resolver;
  const reserveCents = Math.max(0, Math.round(args.miscReserveContributionCents || 0));
  const displayedTotalCents = Math.max(0, resolver.effectiveTotalCents + reserveCents);

  // ── 1. Walk every resolved row into its bucket. ─────────────────────────
  const buckets: BucketCents = {
    essentials: 0,
    food: 0,
    activities: 0,
    transit: 0,
    misc: 0,
  };
  const rowsByBucket: Record<BucketKey, ResolvedRow[]> = {
    essentials: [],
    food: [],
    activities: [],
    transit: [],
    misc: [],
  };

  for (const row of resolver.rows) {
    // Day-0 hotel/flight rows: skip the per-row walk so the dedicated
    // "effective hotel/flight" cents (which include manual override deltas)
    // become the sole essentials contribution. Without this, a manual hotel
    // override would double-count: once via canonical Day-0 row, once via
    // manualHotelDelta.
    if (row.isLogisticsRow) {
      const cat = (row.category || '').toLowerCase();
      if (cat === 'hotel' || cat === 'flight' || cat === 'flights') continue;
      // Other day-0 rows (e.g. day-0 transit/misc): keep them in their bucket
      // so the bucket sum tracks them (rather than disappearing into the
      // residual). They'll show in the right bucket header total even if
      // PaymentsTab's row renderer doesn't surface them as a line item.
    }
    const key = bucketForRow(row);
    buckets[key] += row.cents;
    rowsByBucket[key].push(row);
  }

  // ── 2. Effective hotel/flight (toggle + manual override applied). ───────
  // Mirrors `useTripFinancialSnapshot.effectiveHotelCents/effectiveFlightCents`.
  const effectiveHotelCents = args.includeHotel
    ? Math.max(0, resolver.canonicalDay0HotelCents + resolver.manualHotelDelta)
    : 0;
  const effectiveFlightCents = args.includeFlight
    ? Math.max(0, resolver.canonicalDay0FlightCents + resolver.manualFlightDelta)
    : 0;
  buckets.essentials += effectiveHotelCents + effectiveFlightCents;

  // ── 3. Manual non-hotel/flight payments. ────────────────────────────────
  // The resolver folded `manualOtherCents` into `effectiveTotalCents` but the
  // per-row walk doesn't see them (they live in trip_payments, not in
  // activity_costs). Add to `misc` so the headline equation balances; manual
  // payments rendered with a specific `item_type` (dining/transport/etc.)
  // are still itemized via PaymentsTab's separate manual-row pass.
  buckets.misc += resolver.manualOtherCents;

  // ── 4. Misc reserve contribution. ───────────────────────────────────────
  buckets.misc += reserveCents;

  // ── 5. Residual fold — guarantees sum(buckets) === displayedTotal. ──────
  const bucketsSum =
    buckets.essentials +
    buckets.food +
    buckets.activities +
    buckets.transit +
    buckets.misc;
  const residual = displayedTotalCents - bucketsSum;
  if (residual !== 0) {
    buckets.misc += residual;
  }
  const bucketsSumCents = displayedTotalCents; // post-fold, by construction

  return {
    displayedTotalCents,
    buckets,
    bucketsSumCents,
    residualFoldedCents: residual,
    rowsByBucket,
    resolver,
  };
}

export function decomposeTripCost(args: DecomposeArgs): DecompositionResult {
  const resolver = resolveCanonicalCostRows({
    costs: args.costs,
    liveActivities: args.liveActivities,
    includeHotel: args.includeHotel,
    includeFlight: args.includeFlight,
    manualPayments: args.manualPayments,
    travelers: args.travelers,
  });
  return decomposeResolvedTripCost({
    resolver,
    includeHotel: args.includeHotel,
    includeFlight: args.includeFlight,
    miscReserveContributionCents: args.miscReserveContributionCents,
  });
}
