## Root cause

The Budget tab renders numbers from **three independent sources of truth** that update on different cadences and use slightly different inclusion rules. When any one of them refreshes before the others, the UI shows mathematically inconsistent figures (38% with $690, then 38% with $1,125, then 63% with $1,125).

The three sources, all derived from `activity_costs`:

| # | Source | Where computed | Used for |
|---|--------|----------------|----------|
| 1 | `summary` (React Query: `tripBudgetSummary`) | `getBudgetSummary` → `getBudgetLedger` → reconciled against `v_trip_total` view | category breakdown, ledger rows, "Food & Dining $1,749" etc. |
| 2 | `snapshot.tripTotalCents` (custom hook `useTripFinancialSnapshot`) | direct `activity_costs` sum, with own hotel/flight toggle logic | over-budget banner status + percent + the "Total Estimated Cost" headline |
| 3 | `v_trip_total.total_all_travelers_usd` (Postgres view) | server-side aggregation | reconciliation target inside `getBudgetLedger` only |

**The smoking gun in `BudgetTab.tsx` line 401–405:**

```tsx
<BudgetWarning summary={{
  ...summary,            // dollar fields from source #1
  usedPercent: snapshotUsedPct,   // percent from source #2
  status: snapshotStatus,         // status from source #2
}} />
```

Inside `BudgetWarning.tsx`:
- Percent shown = `summary.usedPercent − 100` ← was overridden, so reflects **snapshot**
- Dollar overage shown = `totalCommittedCents + plannedTotalCents − budgetTotalCents` ← **NOT** overridden, reflects **summary**

So the percent and the dollar amount are literally pulled from different aggregations of the same data. That's why a single render can show "$690 (38%)" while another shows "$1,125 (38%)" — the percent stayed cached from one source while the dollars flipped to the other.

A second contributing bug: `useTripFinancialSnapshot` and `getBudgetSummary` apply hotel/flight toggle exclusion using slightly different criteria:
- Snapshot: row excluded only if `day_number === 0 && category === 'hotel'` (or flight)
- Summary: every row tagged `category=hotel` is treated as committed-hotel and toggled, regardless of `day_number`

If hotel rows exist on day 1+ (which happens for accommodation activities in the itinerary, not just the day-0 logistics row), the two totals diverge by exactly the hotel cost.

## Fix plan

### Phase 1 — Single source of truth (eliminates the inconsistency entirely)

1. **Make `useTripFinancialSnapshot` the only source.** Replace all uses of `summary.usedPercent`, `summary.totalCommittedCents`, `summary.plannedTotalCents`, `summary.remainingCents`, `summary.status` in the **render path** with values derived from `snapshot`.
2. Keep `useTripBudget`/`getBudgetSummary` only for the **category breakdown** (the per-category buckets aren't computed by the snapshot). Reconcile breakdown totals: scale the per-category numbers so they sum to `snapshot.tripTotalCents` (largest-remainder adjustment, same trick already used in `getBudgetLedger`). This keeps the breakdown directionally correct without letting it drift from the headline.
3. **Compute overage dollars and percent from the same numerator/denominator:**
   ```ts
   const overageCents = snapshot.tripTotalCents - settings.budget_total_cents;
   const overagePercent = (overageCents / settings.budget_total_cents) * 100;
   ```
   Round both at render time only. Never mix sources.
4. **Update `BudgetWarning`** to take `overageCents` and `overagePercent` as props directly (no more deriving from a `summary` object that may be partially overridden). Same for `usedPercent` and `remainingCents`.

### Phase 2 — Align inclusion rules

5. In `useTripFinancialSnapshot`, change the hotel/flight exclusion to match `getBudgetSummary` exactly:
   - Use the row's `category` field, not `day_number`, to decide hotel/flight.
   - Single helper `shouldCountRow(row, settings)` exported from `tripBudgetService.ts` and used by both the snapshot and the summary.
6. In `tripBudgetService.ts`, replace the per-entry toggle logic with the same helper, so the ledger and the snapshot can never disagree.

### Phase 3 — Defensive guards

7. In `BudgetTab.tsx`, add a dev-only assertion:
   ```ts
   if (import.meta.env.DEV && summary && Math.abs(summary.usedPercent - snapshotUsedPct) > 0.5) {
     console.error('[budget] source mismatch', { summary, snapshot });
   }
   ```
   This catches future regressions during development.
8. Bump the React Query cache key for `tripBudgetSummary` to include the snapshot's `tripTotalCents` rounded to the dollar, so a snapshot refetch invalidates the summary cache. Removes the stale-summary-fresh-snapshot window.
9. Add a `useTripBudgetService.test.ts` fixture: insert known activity_costs rows, assert `snapshot.tripTotalCents === summary.totalCommittedCents + summary.plannedTotalCents` for the same trip + settings.

### Phase 4 — Category drift (the secondary symptom: Food & Dining $1,749 → $1,999, Transit $472 → $530)

These shifted because `getBudgetLedger` runs the largest-remainder adjustment **only when `v_trip_total` view returns data**. If the view is slow or returns null on the first read, no adjustment is applied; on the second read it kicks in and one category absorbs the diff. Fix:

10. If `v_trip_total` is null or stale (older than 5s vs. `activity_costs.updated_at`), recompute the canonical total client-side from the raw `activity_costs` rows just fetched, and run the adjustment against that. Never let the ledger return un-reconciled.

## Files to change

- `src/components/planner/budget/BudgetTab.tsx` — drop mixed-source rendering (lines 381–407 and 410–431), feed BudgetWarning with snapshot-only props
- `src/components/planner/budget/BudgetWarning.tsx` — accept explicit `usedPercent`, `overageCents`, `remainingCents`, `status`, `currency` props instead of a `BudgetSummary` blob
- `src/hooks/useTripFinancialSnapshot.ts` — use shared `shouldCountRow` helper
- `src/services/tripBudgetService.ts` — export `shouldCountRow`, fall back to client-side total when `v_trip_total` is missing
- `src/hooks/useTripBudget.ts` — derive `isOverBudget`/`warningLevel` from snapshot, not summary
- `src/services/tripBudgetService.test.ts` (new) — invariant test: snapshot total = summary total

## Out of scope

- Server-side `v_trip_total` view changes. We work around its staleness client-side; rebuilding it is a separate task.
- Visual/UX changes to the warning banner itself.

## Why this works

After the fix, every number on the Budget tab traces back to one query (`activity_costs` filtered by `shouldCountRow`). The over-budget banner cannot show "$690 (38%)" one second and "$1,125 (38%)" the next, because both numbers come from the same atomic snapshot. The category breakdown is forced to sum to that snapshot via largest-remainder, so Food & Dining can't silently jump $250 between renders.