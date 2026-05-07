## Problem
Payments is showing category buckets totaling $480 while Budget shows a $600 trip total. The gap scales with trip size because Payments line items and Budget totals still use different cost-resolution paths.

## Root cause
- `useTripFinancialSnapshot` already uses `resolveCanonicalCostRows()` and adds the misc/spending-money reserve.
- `usePayableItems()` still rebuilds rows from raw `activity_costs` with its own orphan-rescue, logistics, manual, and category logic.
- `getBudgetLedger()` / Budget All Costs also applies a third filtering path that drops orphan rows instead of using the canonical resolver.
- Result: header totals, Payments buckets, Budget category totals, and All Costs can disagree permanently.

## Implementation plan
1. **Make canonical resolver return display-ready row data**
   - Extend `ResolvedRow` with the display name, raw row id, source row fields, effective category, and paid metadata needed by UI lists.
   - Preserve existing walking-is-free, orphan rescue, JSON rescue, hotel/flight inclusion, and $0 filtering behavior.

2. **Refactor `usePayableItems()` to consume canonical rows**
   - Replace the duplicated DB-row/orphan-rescue loop with `resolveCanonicalCostRows()` output.
   - Keep manual expense handling and transit grouping, but build activity/food/transit/misc rows from canonical rows only.
   - Ensure visible Payments bucket sum equals `canonical.totalCents + manual deltas + misc reserve`.

3. **Fetch complete cost rows in both Payments and Budget**
   - Update `activity-costs-payable` queries to include `id`, `source`, `is_paid`, and `paid_amount_usd` so the resolver has the same data as the snapshot.

4. **Align Budget All Costs and category usage**
   - Update Budget’s ledger/category list path to use the same canonical resolver instead of independently filtering raw `activity_costs`.
   - Keep the Budget headline total from `useTripFinancialSnapshot`, and make Budget category used amounts derive from the same canonical rows where practical.

5. **Remove misleading reconciliation state**
   - Do not show a “matches itinerary” badge if Payments buckets are built from stale raw rows.
   - If a mismatch somehow remains, show a finite diagnostic with exact bucket/header totals, not a processing state.

6. **Regression coverage**
   - Add/update tests for:
     - Venice-style $600 snapshot matching $600 Payments bucket sum.
     - $0 walking legs never appearing as paid rows.
     - Misc reserve counted exactly once.
     - Orphan/stale activity rows do not create Budget/Payments drift.
     - Manual hotel/flight override does not double-count canonical logistics rows.

## Expected result
Payments category totals, Payments Trip Total, Budget headline, Budget category usage, and All Costs are all derived from the same canonical source, so the $120 gap disappears instead of growing with trip size.