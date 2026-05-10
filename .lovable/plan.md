## Audit goal

Confirm or disprove the hypothesis that 1 dining row is having `cost_per_person × num_travelers` applied twice. Walk one row through the four boundaries, then either patch the offending writer OR install a permanent invariant assertion that catches it on the next regression.

## What I already verified statically

The math chain is symmetric and multiplies `num_travelers` exactly once:

| Layer | Formula | File |
|---|---|---|
| Schema | `total_cost_usd GENERATED ALWAYS AS (cost_per_person_usd × num_travelers) STORED` | `supabase/migrations/20260301122724_…sql` |
| View `v_trip_total` | `SUM(total_cost_usd) AS total_all_travelers_usd` | same migration |
| `getBudgetLedger` row → `amount_cents` | `Math.round(cost_per_person_usd × num_travelers × 100)` | `src/services/tripBudgetService.ts:512` |
| Reconciliation | `largest-remainder` aligns `rawSum` to `v_trip_total.total_all_travelers_usd × 100`; both already include `× num_travelers` | `tripBudgetService.ts:577-596` |
| `getBudgetSummary` rollup | `plannedFood += entry.amount_cents` (no extra mult) | `tripBudgetService.ts:649-661` |
| Display | `formatCurrency(plannedFoodCents)` | `BudgetSummaryPanel.tsx:156` |

There is **no** category-level double-multiplication in the rollup or display. The only realistic root cause is therefore a **writer** that stores a TOTAL into `cost_per_person_usd` while keeping `num_travelers ≥ 2` — which inflates by exactly `×num_travelers` end-to-end.

## Step 1 — Inspect live data for the suspect trip (read-only DB)

Run a diagnostic query against `activity_costs` to find dining rows where `cost_per_person_usd` is implausibly high relative to `cost_reference` mid-band:

```sql
SELECT ac.id, ac.trip_id, ac.day_number, ac.activity_id,
       ac.cost_per_person_usd, ac.num_travelers, ac.total_cost_usd,
       ac.source, ac.notes, ac.created_at, ac.updated_at,
       cr.cost_low_usd, cr.cost_mid_usd, cr.cost_high_usd
FROM activity_costs ac
LEFT JOIN cost_reference cr ON cr.id = ac.cost_reference_id
WHERE ac.category IN ('dining', 'food')
  AND ac.num_travelers >= 2
  AND ac.cost_per_person_usd > COALESCE(cr.cost_high_usd, 200) * 1.5
ORDER BY ac.updated_at DESC
LIMIT 50;
```

Cross-reference with the user's reported trip ($1,412 / 6 dining / 4 days / 2 travelers ⇒ expect cpp ≈ $117). If we find rows where `cost_per_person_usd ≈ 235` (the "total") **and** `num_travelers = 2`, root cause is confirmed at the writer.

## Step 2 — Audit every writer of `cost_per_person_usd`

Each writer must satisfy: **value passed in is per-person**, not total. Files identified by `rg`:

1. `supabase/functions/generate-itinerary/generation-core.ts:3328` — pulls `cost_low_usd` / `cost_mid_usd` / `cost_high_usd` from `cost_reference`. Reference values are documented per-person — **OK**, but add a sanity log if `costPerPerson > cost_high_usd × 3`.

2. `supabase/functions/generate-itinerary/action-repair-costs.ts:486` — `finalCost = costPerPerson` where `costPerPerson` originates from `activity.estimatedCost` / `activity.estimated_cost` / `activity.cost` / `activity.cost.amount` (line 249-253). **The Cost-Repair JSONB Parity memory mandates `cost.amount` is per-person.** Verify by spot-check: if any code path writes a TOTAL into `activity.cost.amount`, repair will silently re-snapshot it as cpp and the view inflates by `× num_travelers`.

3. `supabase/functions/backfill-activity-costs/index.ts` — backfill from JSONB. Same risk surface as repair.

4. `src/services/budgetLedgerSync.ts:42, 57, 73` — explicitly divides `totalUsd / numTravelers`. **OK** (hotel/flight only).

5. `src/services/activityCostService.ts` — manual ledger writes (Add Custom Cost dialog). Inspect to confirm the dialog labels its input as "per person" and writes that value as `cost_per_person_usd`. If the label says "total" but the value is written into the `cpp` column, this is the bug.

6. Any direct `update` on `activity_costs` from `useTripFinancialSnapshot` / `useTripDayBreakdown` / `usePayableItems` / inline-edit handlers — search:
   ```
   rg -n "from\\('activity_costs'\\)\\.update|from\\('activity_costs'\\)\\.insert" src
   ```

For each writer, either confirm per-person semantics OR fix in place by dividing by `num_travelers`.

## Step 3 — Add a permanent invariant assertion

Even after a one-time fix, this class of bug will return unless we instrument it. Add a write-time guard in **`activityCostService.ts`** (the canonical client writer) and the equivalent place in **`action-repair-costs.ts`** for the edge path:

```ts
// Sanity gate: if the caller hands us a per-person value that is wildly
// above the reference high-band, log loudly. Catches "writer passed total".
if (ref?.cost_high_usd && cpp > ref.cost_high_usd * 3) {
  console.error(
    `[CPP_DOUBLE_COUNT?] activity=${activityId} cpp=$${cpp} ` +
    `nt=${numTravelers} ref_high=$${ref.cost_high_usd} ` +
    `→ likely caller wrote total instead of per-person`
  );
}
```

Mirror as a `RAISE NOTICE` inside the existing `activity_costs` insert/update trigger so we get DB-level breadcrumbs even when an unknown writer is to blame.

## Step 4 — Add a unit test

`src/services/tripBudgetService.test.ts` (or new): given 6 fixture rows with `cpp=117.50, nt=2`, the rollup must produce `plannedFoodCents === 1410_00`. Given the corrupted shape `cpp=235, nt=2`, the rollup produces `2820_00` — proving the inflator is upstream, not in the rollup, and locking the read-side semantics.

## Out of scope

- No schema change to `total_cost_usd` (already a generated column).
- No change to the `v_trip_total` reconciliation logic.
- No UI change unless Step 1 reveals display-layer drift (none identified statically).

## Expected outcome

After Step 1, one of two:

- **A.** Live data shows `cpp` matches per-person reference band → user's $1,412 is *not* a double-count, it's the legitimate luxury dinner band. Document and close.
- **B.** Live data shows `cpp` ≈ $235 (= total) → fix the offending writer (most likely candidate: `activityCostService.ts` manual entry or a JSONB writeback that swapped per-person↔total) and add the Step 3 assertion + Step 4 test as a regression net.