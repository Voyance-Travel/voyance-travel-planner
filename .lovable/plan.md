## Bug

Inside the **Budget by Category** card on the Budget tab, the footer line `Total from itinerary` (BudgetTab.tsx L1206–1212) sits visually at the bottom of the **Discretionary** subsection and reads as "sum of discretionary" — even though the value is `snapshot.tripTotalCents`, which already folds in hotel + flight per the user's `budget_include_hotel` / `budget_include_flight` toggles.

The numbers are correct; the label and placement are misleading.

## Confirmed mechanics

- `snapshot.tripTotalCents` (resolveCanonicalCostRows → effectiveTotalCents) **already includes** hotel and flight whenever the corresponding toggle is on (`budget_include_hotel` defaults true; `budget_include_flight` defaults false). Memory: `mem://constraints/payments/single-resolver-manual-fold`, `mem://technical/finance/budget-visibility-policy`.
- The same `snapshot.tripTotalCents` also drives the **Trip Expenses** big-number card (L928–999). So the lower line is partially redundant — its only purpose is footer validation under the category breakdown.
- The category breakdown itself splits into **Fixed Costs** (hotel/flight, when included) and **Discretionary** (food/activities/transit/misc). The "Total from itinerary" sits after the Discretionary list with only a thin `border-t` separator, which is what makes it read as a discretionary subtotal.

## Fix (UI / labeling only — no math, no resolver changes)

Scope: `src/components/planner/budget/BudgetTab.tsx` only. No backend, no hooks, no `useTripFinancialSnapshot`.

### 1. Rename and re-scope the footer line

Replace the static label `"Total from itinerary"` with a label that names what's actually summed:

- Default copy: `"Trip total"` (bolder weight) with secondary caption listing the contributors based on toggle state, e.g.:
  - hotel ON + flight OFF → `"Hotel + dining + activities + transit"`
  - hotel ON + flight ON → `"Hotel + flight + dining + activities + transit"`
  - hotel OFF + flight OFF → `"Dining + activities + transit only · hotel & flight excluded"` (muted amber)
  - hotel OFF + flight ON → `"Flight + dining + activities + transit · hotel excluded"`

The exclusion variants get a tiny inline `Info` icon → tooltip explaining the toggle is the lever (matches the existing toggle UI further down the page) so users know how to flip back.

### 2. Make the footer visually separate from Discretionary

Increase visual separation so the line reads as a card footer, not a list item:
- Bump `pt-3 border-t border-border` → `pt-4 mt-2 border-t-2 border-border`
- Add a leading `<TrendingUp />` icon (matching Trip Expenses card) so it visually echoes the top KPI rather than blending into the list rows.
- Right-align as a two-row stack: bold value on top, faint contributor caption below.

### 3. Drop the `> 0` gate that hides the footer on empty itineraries

Currently `snapshot.tripTotalCents > 0` hides the line entirely. Keep the gate but show a single muted "—" placeholder when the snapshot is loading so the footer position doesn't jump after data arrives. (Don't render anything when there's truly no itinerary, matching the existing `hasNoMeaningfulActivities` empty-state above.)

### 4. (Optional within same edit) Tiny in-place breakdown

Add a one-line decomposition right under the bold total, reusing values already in `allocations`:

```
$1,840  Trip total
        Hotel $720 · Activities $1,120
```

This leaves zero ambiguity about scope. Fixed-cost rows are pulled from `allocations.filter(a => a.kind === 'fixed')` (already computed); discretionary subtotal = `tripTotalCents − sum(fixed)`. Skip rendering when only one category is present so we don't repeat the headline number.

## Out of scope

- Resolver/snapshot math (already correct).
- Trip Expenses big-number card at the top (already labeled clearly).
- Toggle behavior (`Include Hotel in Budget`, `Include Flights in Budget`) — works correctly.
- Payments tab and any cost-table/ledger work.

## Files

- `src/components/planner/budget/BudgetTab.tsx` — only file touched. Edits localized to L1206–1212 plus a small helper for the contributor caption near the top of the component.

## Verification

- Manual preview check on a trip with hotel toggle ON and OFF; confirm the caption flips and the math equals the headline `Trip Expenses` figure in both states.
- Eyeball with both 1-traveler and N-traveler trips (no per-person change here, but confirm layout doesn't wrap awkwardly).
- No tests required (pure presentation change, deterministic from existing snapshot fields).
