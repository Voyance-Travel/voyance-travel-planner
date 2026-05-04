# Budget Reconciliation — Three Passes

You confirmed: do all three sequentially, and surface hidden DB rows as a per-day **"Other / fees"** line so the day total always equals the visible items.

## Why the numbers drift

There are **two parallel cost universes** in the app:

```text
World A — in-memory     : activity.cost.amount        → getDayTotalCost → day badges, line items
World B — database      : activity_costs.cost_*_usd   → useTripFinancialSnapshot → header, breakdown, coach
```

Every "X doesn't equal Y" symptom is one of these two disagreeing:
- **Day total ≠ line items**: day badge reads World A, but World A's filter (`isEstimated ? 0 : amount`) drops some rendered rows; meanwhile the DB has rows for the day that aren't even in the rendered list (transit micro-legs, service fees written by `syncBudgetFromDays`).
- **Header ≠ category breakdown**: both read World B but with different inclusion/rounding rules and stale React Query caches.
- **EUR/USD looks inflated**: World A stores some upstream prices already in EUR but tagged `currency: 'USD'`, so the USD→EUR conversion in the Budget tab applies the FX rate to a number that's already in euros.
- **Numbers shift with no input**: `BudgetTab` invalidates its own queries every time the snapshot total changes (lines 307–312), and `syncBudgetFromDays` re-writes `activity_costs` on each itinerary view, sometimes with different rounding than last time.

## Pass 1 — Reconciliation (this turn's main work)

**Goal:** every visible number derives from one canonical aggregator: `useTripFinancialSnapshot` → which reads `activity_costs`. World A becomes display-only.

### 1a. New per-day aggregator
Add `useTripDayBreakdown(tripId)` next to `useTripFinancialSnapshot`. Single query that returns:

```ts
{
  byDay: Record<dayNumber, {
    totalCents: number,
    visibleCents: number,        // rows with activity_id matching a rendered card
    otherCents: number,          // rows with no matching card (transit micro-legs, service)
    rows: ActivityCostRow[],     // for the "Other / fees" expansion
  }>
}
```

Both this hook and `useTripFinancialSnapshot` share the same fetch + the same `shouldCountRow` rule, so they cannot drift.

### 1b. Day badges read from the new hook
Replace `getDayTotalCost(day.activities, …)` (called at lines 3140 and 9230 of `EditorialItinerary.tsx`) with `dayBreakdown.byDay[day.dayNumber].totalCents`. Convert to display currency through the shared `currency.ts` helper.

`getActivityCostInfo` and `getDayTotalCost` stay alive **only** for the in-card "what does this item cost" display — they no longer feed totals.

### 1c. Add "Other / fees" line per day
When `otherCents > 0`, render a small dimmed row at the end of the day (above the day total) showing the aggregate and an expand affordance listing the underlying notes. Day total then visibly equals visible items + Other = badge.

### 1d. Single category aggregator
Move `getCategoryAllocations` to read directly from the same fetch the snapshot uses (instead of a separate `getBudgetSummary` round-trip). Eliminates the `[budget] source mismatch` warning path entirely.

### 1e. Kill the invalidation loop
Remove the `useEffect` at `BudgetTab.tsx:307-312` that invalidates summary/ledger/allocations queries whenever `snapshot.tripTotalCents` changes. After 1d there's nothing to keep in sync — the snapshot *is* the source. This eliminates the "numbers shift on their own" effect when a sync writes a row.

## Pass 2 — Currency audit

**Goal:** every cost in `activity_costs.cost_per_person_usd` is actually USD, and the FX rate the user sees matches reality.

### 2a. Audit upstream writes
`rg` for every `.insert` / `.update` into `activity_costs` and verify the value being written is USD. Specifically check:
- `budgetLedgerSync.ts` — already USD ✓
- `syncBudgetFromDays` (in `EditorialItinerary.tsx`) — converts from `activity.cost` which may carry a non-USD currency. **Suspected bug**: it writes the raw amount without converting. Fix: route through `toUsdCents(amount, currency)` from `currency.ts`.
- Any chat-planner / extract / parse paths that write costs.

### 2b. Add a write-time invariant
Wrap all `activity_costs` writes in a single helper `writeActivityCost({ amountUsd, … })` that asserts `currency === 'USD'` and logs+rejects anything else in dev. Future regressions become loud.

### 2c. Backfill + repair
One-time SQL pass: for trips where the header total / known-good external reference (e.g., the trip's `budget_currency`) suggests stored USD values are actually in another currency, recompute and update. Logged, opt-in per trip via admin toggle (no silent mass-mutation of historical data).

### 2d. Display rate transparency
The `rateDisclosure` tooltip already exists. Add the **effective implied rate** (header total / sum of EUR line items) shown next to the disclosed rate when they differ by >2% — a self-diagnosing indicator that something upstream is mis-tagged.

## Pass 3 — Stability + remaining drift

### 3a. Make `syncBudgetFromDays` idempotent
Currently it deletes/re-inserts on each itinerary view, which causes ID churn and minor rounding shifts. Switch to upsert-by-`activity_id` with a content hash so unchanged rows are skipped. No DB write → no snapshot delta → no toast.

### 3b. Snapshot debouncing
Coalesce `booking-changed` events within a 250ms window so a burst of writes (e.g., hotel save → flight save → itinerary repair) produces one refetch and one delta toast, not three.

### 3c. End-to-end verification
For your Paris trip: open Budget tab, verify (a) Day 3 badge equals Le Cinq + Hôtel de la Marine + Le Comptoir + Arpège + Jazz Club + (Other if any), (b) Day 4 badge equals its three rendered items exactly, (c) header EUR total ÷ header USD total is within 0.5% of the disclosed rate, (d) toggling Hotel switch produces exactly one number change with one toast.

## Files

- **New**: `src/hooks/useTripDayBreakdown.ts`
- `src/components/itinerary/EditorialItinerary.tsx` (day badges + "Other / fees" line + sync idempotency + currency normalize on write)
- `src/components/planner/budget/BudgetTab.tsx` (remove invalidation loop, route allocations through new hook)
- `src/services/tripBudgetService.ts` (allocations source change, drop redundant getBudgetSummary path)
- `src/services/budgetLedgerSync.ts` (use shared `writeActivityCost` helper)
- `src/services/activityCostService.ts` (new `writeActivityCost` invariant wrapper)
- `src/lib/currency.ts` (already in place)
- One-time SQL repair migration for trips with mis-tagged USD values (Pass 2c, opt-in)

## Out of scope

- Redesigning `getActivityCostInfo` itself (it stays as the per-line-item display estimator).
- Changing how `cost_reference` is populated.
- The Budget Coach intent system (already shipped last turn).

## Sequencing

I'll execute Pass 1 first (the biggest trust win), then in this same turn run Pass 2's audit (read-only — list every offending write) and apply 2a/2b. Pass 2c (backfill) and Pass 3 land after you've eyeballed the Pass 1 result so we don't compound changes blindly.