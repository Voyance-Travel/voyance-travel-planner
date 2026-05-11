## Problem

Madrid trip `8a8599b0…1b1d` confirms the bug:

- **`activity_costs` table:** 1 row total — only the $1,800 hotel.
- **Itinerary JSON:** 16 activities, 7 priced (~€470/pp × 2 travelers + hotel ≈ $2,700+ real spend).
- **Budget tab "Trip Expenses":** shows the misc-reserve sliver (~$160) because the resolver returns ~$1,800 hotel that the user has hidden via the include-hotel toggle, and only the spending-money reserve survives.

The architecture is already correct on paper — `useTripFinancialSnapshot` → `resolveCanonicalCostRows` → `activity_costs` is the single source of truth. The actual bug is **upstream**: the per-day chain generator did not write `activity_costs` rows for the priced JSON activities on this trip, so the budget tracker has nothing to read for dining / activities / transit.

There is already a one-shot **auto-backfill** in `useTripFinancialSnapshot.ts` that calls `sync-trip-cost-table` to repair legacy trips, but its trigger condition is too narrow:

```ts
// current (line ~310)
if (canonical.totalCents === 0 && liveActivities.some(a => a.jsonCost > 0)) {
  // fire sync-trip-cost-table
}
```

For this Madrid trip `canonical.totalCents = 180,000¢` (the hotel row exists), so the guard never fires and the dining/activities rows never get backfilled. This is the recurring "$160 vs $3,600" symptom.

## Fix

### 1. Broaden the auto-backfill trigger — `src/hooks/useTripFinancialSnapshot.ts`

Replace the strict `totalCents === 0` gate with a **coverage** check that detects "JSON has priced activities that don't have a matching `activity_costs` row":

```ts
const pricedJsonIds = new Set(
  liveActivities.filter(a => a.jsonCost > 0).map(a => a.id)
);
const coveredIds = new Set(
  (costs || [])
    .filter(c => c.activity_id && (c.cost_per_person_usd || 0) > 0)
    .map(c => String(c.activity_id))
);
const uncoveredPriced = [...pricedJsonIds].filter(id => !coveredIds.has(id));
const coverageRatio = pricedJsonIds.size > 0
  ? 1 - (uncoveredPriced.length / pricedJsonIds.size)
  : 1;

if (
  !backfillFiredRef.current &&
  pricedJsonIds.size > 0 &&
  coverageRatio < 0.5     // >50% of priced JSON activities have no cost row
) {
  backfillFiredRef.current = true;
  // fire sync-trip-cost-table (existing call)
}
```

Sentinel log: `[useTripFinancialSnapshot] activity_costs coverage <X%> for trip <id> (uncovered=<N>) — triggering backfill`.

### 2. Verify `sync-trip-cost-table` actually writes the rows

`supabase/functions/sync-trip-cost-table/index.ts` should already be wired to `writeActivityCostsFromItinerary` (per the existing **Activity Costs Write Parity (M6)** memory). Confirm:

- It iterates every day's activities, not only Day 0.
- It writes `cost_per_person_usd` from `activity.cost.amount` (or numeric `cost`) when `>0`.
- It writes both `dining` and `activity` categories so the breakdown later sorts into Food / Activities / Transit.

If anything is missing (e.g. it only syncs hotel/flight), extend it to mirror the per-day chain's full write loop.

### 3. Add a diagnostic counter to the canonical resolver — `src/services/canonicalCostRows.ts`

Already returns `effectiveTotalCents` and per-category breakdowns. Add an explicit `pricedJsonRescueCents` field that captures the "JSON rescue" path so we can tell when the snapshot is leaning on the rescue (sign of unwritten rows). Surface in dev console only.

### 4. UI smoke-check — `src/components/planner/budget/BudgetTab.tsx`

No code change needed if (1) and (2) are correct. The card already reads `snapshot.tripTotalCents`, `byCategory` is already exposed via `getBudgetSummary`. After the backfill fires once, refetch will pick up the real numbers.

## Verification

1. Reload the Madrid trip dashboard — backfill fires, `activity_costs` populates from JSON, "Trip Expenses" jumps from `$160` → `$2,700+`.
2. `psql -c "SELECT category, COUNT(*), SUM(cost_per_person_usd*num_travelers) FROM activity_costs WHERE trip_id='8a8599b0-…' GROUP BY category;"` shows `hotel`, `dining`, `activity` rows.
3. Generate a fresh 3-day trip — `activity_costs` is populated at generation time (pre-existing M6 path), backfill never fires.
4. **Memory update:** add a constraint note `Budget Snapshot Coverage Backfill` referencing the new gate condition + sentinel log so future debugging finds it.

## Out of scope

- No changes to `BudgetTab.tsx` UI — already correct.
- No changes to `tripBudgetService.getBudgetSummary` math — also already correct.
- The user's prompt's `mapToBudgetCategory` shape is already implemented as `toBudgetCategory` in `tripBudgetService.ts`.