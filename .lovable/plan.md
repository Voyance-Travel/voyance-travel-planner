## Problem

Three independent failure modes on the Payments tab:

1. **Headline divergence**: PaymentsTab `Trip Total` and itinerary header `Trip Total` can disagree even though both already share `useDisplayedTripTotal`. The "Matches itinerary" badge uses a real `≤$1` tolerance check (`PaymentsTab.tsx` L1205-1208) — so when this lies, the underlying data diverged after one of them rendered, not because the badge is hard-coded.

2. **Bucket sum ≠ headline (Bali pattern $900+$480+$200=$1,580 vs $1,322)**: PaymentsTab buckets are re-summed from `usePayableItems` rows (`bucketSumCents` at L495-500) while headline uses `useDisplayedTripTotal`. There is no invariant tying the two together — only a `console.warn` (`path='B'` at L514). Root causes of this drift today:
   - `usePayableItems` skips `isLogisticsRow` rows (L364) but the snapshot's canonical resolver counts them in `totalCents`.
   - Manual misc/shopping rows + the synthetic reserve row in `miscItems` (L475-489) double-count when the same dollars are already inside snapshot via `manualOtherCents` + `miscReserveContributionCents` (`useTripFinancialSnapshot` L297, L480).
   - Reserve folding is asymmetric: snapshot adds `contributionToTotalCents` (clamped by `loggedMisc`) while PaymentsTab adds the **full** `miscReserveCents` to the misc bucket.

3. **Stale post-refresh (Bali $1,322 unchanged after 4 dining cards lost)**: The `activity_costs` table still holds the pre-loss rows, so the canonical resolver returns the old total even after the JSON regressed. The headline ALSO reads the same stale rows, hiding the contradiction. This is a sync-tables/freeze-timing issue surfacing here because Payments is the only place users compare numbers carefully.

## Goal

Single decomposition service so Payments buckets sum to the headline by construction, badge truthfully reflects equality, and stale `activity_costs` rows trigger a resync rather than silently inflating Payments.

## Plan

### 1. New service `src/services/tripCostDecomposition.ts`

Input: same as the canonical resolver (`costs`, `liveActivities`, `manualPayments`, `includeHotel`, `includeFlight`, `travelers`, `miscReserveContributionCents`).

Output:
```ts
{
  displayedTotalCents: number;          // matches useDisplayedTripTotal
  buckets: {
    essentials: number;                 // hotel + flight (effective)
    food: number;
    activities: number;
    transit: number;
    misc: number;                       // manual misc + reserveContribution + unattributed remainder
  };
  rowsByBucket: Record<bucketKey, ResolvedRow[]>;
  // Invariant: sum(buckets) === displayedTotalCents (residual folded into misc).
  residualFoldedCents: number;
}
```

Implementation: walk `canonical.rows` once, classify into a bucket via the existing `toBudgetCategory` map, count `manualHotelDelta` / `manualFlightDelta` / `manualOtherCents` / `miscReserveContributionCents` from the same resolver result, then compute `residual = displayedTotal − sum(buckets)` and add it to `misc`. Telemetry-warn when `|residual| > $2`.

### 2. Refactor `usePayableItems` and `useTripFinancialSnapshot` to consume it

Both keep their public APIs but internally delegate the bucket math + headline math to `tripCostDecomposition`. Concretely:
- `useTripFinancialSnapshot.tripTotalCents` ← `decomposition.displayedTotalCents` (already what header shows).
- `usePayableItems` keeps emitting `PayableItem[]` for the UI but uses `decomposition.rowsByBucket` so logistics rows that were silently dropped (case 2.a above) now surface as a per-day row in the right bucket instead of vanishing.

### 3. PaymentsTab (`src/components/itinerary/PaymentsTab.tsx`)

- Replace local `bucketSumCents` (L495-500) and the per-bucket recomputations (L456-489) with values from `decomposition.buckets`. Bucket renderers continue to render `PayableItem[]` from `decomposition.rowsByBucket`.
- Drop the synthetic `misc-reserve` row injection (L475-489) — reserve is folded inside `decomposition.buckets.misc` and rendered as a labeled sub-row from `rowsByBucket.misc`.
- Keep the `[PaymentsTab] divergence` telemetry but downgrade Path B to `console.error` (now a contract violation, not a known drift).

### 4. "Matches itinerary" badge truth check

Already does the right thing structurally (L1205-1208). Only change: read `displayedTotal.displayedTotalCents` AND `decomposition.bucketsSumCents` and require `Math.abs(displayedTotal − bucketsSum) ≤ $1`. Otherwise render `Reconciling…`. This makes the badge a true post-condition of the new invariant.

### 5. Stale `activity_costs` resync (Bali post-refresh case)

In `useTripFinancialSnapshot.fetchData`, after the existing coverage backfill block (L420-443), add a *reverse* check:
- Build `liveActivityIds` (already available).
- Find `activity_costs` rows where `activity_id` is non-null, `day_number > 0`, and the id is NOT in `liveActivityIds` AND NOT covered by orphan rescue.
- When the dropped-row cents sum exceeds `$5` and is `> 5%` of the current total, fire a one-shot `sync-trip-cost-table` invocation (same fingerprint guard) so dining cards lost from JSON also drop from the cost table within one refetch.
- Telemetry: `console.info('[useTripFinancialSnapshot] stale activity_costs detected, triggering resync', { staleCents, total })`.

### 6. Tests

Extend `src/services/__tests__/canonicalCostRows.test.ts` siblings:
- `tripCostDecomposition.test.ts`: invariant `sum(buckets) === displayedTotalCents` across 6 fixtures (Bali manual-misc, Copenhagen hotel-only, Casablanca chip-clamp, Osaka logistics-on-day-N, Tokyo manual-flight override, empty).
- `tripCostDecomposition.staleResync.test.ts`: fixture with 4 orphaned dining rows triggers resync flag.

## Out of scope

- Header strip equation rendering — already correct, untouched.
- Backend writers (`writeActivityCostsFromItinerary`, `sync-trip-cost-table`) — covered by existing memories; only the *trigger* condition is added.
- Currency / per-person display.
- Bug #1 freeze policy and Bug #2 toast suppression — already shipped.

## Files

- New: `src/services/tripCostDecomposition.ts`, two test files.
- Edited: `src/hooks/usePayableItems.ts`, `src/hooks/useTripFinancialSnapshot.ts`, `src/components/itinerary/PaymentsTab.tsx`, `mem://index.md` + new constraint memory `mem://constraints/finance/single-cost-decomposition`.
