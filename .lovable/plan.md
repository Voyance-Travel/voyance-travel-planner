# Hotel Costs Missing from Budget Breakdown

## Diagnosis

I traced both symptoms ("$0 Misc", "no Hotel line") to the database for your Paris trip and confirmed two distinct bugs.

**Bug 1 — Hotel has no price attached, so it never enters the budget.**
The Four Seasons George V is saved on the trip with name, address, dates, and photos — but `totalPrice` and `pricePerNight` are both missing. The function that pushes hotel costs into the budget ledger (`syncHotelCostToBudget`) bails out early when there is no price, so no `category='hotel'` row is ever written into `activity_costs`. The Budget tab then derives a hotel allocation row only when `committedHotel > 0` (`tripBudgetService.ts` line 567), so the Hotel/Accommodation line silently disappears from "Budget by Category." The headline total has the same blind spot — it's why your Trip Total feels low.

The "Some budgeted categories have no items yet" amber warning doesn't fire either, because it only checks `hasHotel` (a hotel *object* exists) — not whether that hotel has a usable price.

**Bug 2 — Miscellaneous category is hardcoded to $0.**
`getBudgetAllocations` (line 619 of `tripBudgetService.ts`) sets `usedCents: 0` for the misc row, regardless of what's in the ledger. Meanwhile `toBudgetCategory` does map `nightlife`, `bar`, `club`, `shopping`, `misc` → `misc`, so things like the Day 3 jazz club *should* roll up there but never do. The bar usage is silently swallowed.

## Plan

### 1. Estimate hotel cost when the user picked a hotel without a rate
In `src/services/budgetLedgerSync.ts`, extend `syncHotelCostToBudget` so that when `totalPrice` and `pricePerNight` are both missing, we estimate using the existing `cost_reference` table (the same source the rest of the app uses — no AI estimation, per the cost-integrity rule):
- Look up a hotel rate for the trip's destination + budget tier (luxury/mid/budget) from `cost_reference`.
- Multiply by nights between `checkInDate` and `checkOutDate`.
- Write the row with `source: 'estimated_from_reference'` and `confidence: 'low'` so it's clearly tagged as an estimate.
- Note in the description: `Hotel: Four Seasons George V (estimated)`.

If no reference row exists for the city, fall back to writing a $0 row tagged `needs_price` so the UI can prompt the user.

### 2. Make the "missing price" state visible
In `BudgetTab.tsx`, change the missing-items detector to also flag hotels that exist but have no price. Replace the current `!hasHotel` check with `!hasHotelPrice` (a new prop derived from the hotel selection). Message becomes:
> "Four Seasons George V has no nightly rate set — we've estimated $X/night from typical Paris luxury hotel rates. Add the actual price for a precise budget."

Include an inline "Add price" button that opens the existing hotel editor.

### 3. Wire up Miscellaneous correctly
In `tripBudgetService.ts`:
- Add a `plannedMisc` accumulator alongside `plannedFood/Activities/Transit` in `getBudgetSummary`.
- Replace the hardcoded `usedCents: 0` for the misc allocation row with `summary.plannedMiscCents`.
- Confirm the Day 3 jazz club row maps to `misc` end-to-end (it currently does, via `toBudgetCategory`).

### 4. Trigger a re-sync for the affected trip
After the code change, run a one-time backfill so existing trips with priced hotels (and any future ones) immediately reflect the fix — call `syncHotelCostToBudget` for trips where `hotel_selection` is non-empty but no `category='hotel'` row exists in `activity_costs`. Done as a SQL/edge-function pass, not user-visible.

### Files

- `src/services/budgetLedgerSync.ts` — add reference-based estimation in `syncHotelCostToBudget`
- `src/services/tripBudgetService.ts` — track `plannedMiscCents`; feed misc allocation usage
- `src/components/planner/budget/BudgetTab.tsx` — `hasHotelPrice` prop, richer missing-items warning, "Add price" CTA
- `src/components/itinerary/EditorialItinerary.tsx` (or wherever `hasHotel` is computed) — also derive and pass `hasHotelPrice`
- One-time backfill via migration / edge function call

### Out of scope

- Changing how hotels are selected (the picker not collecting a price is a separate, larger UX issue).
- Changing the budget allocation percentages defaults.

## Verification

After implementation, on your Paris trip the Budget tab should show:
- An **Accommodation** row with the estimated 3-night Four Seasons cost and an "(estimated)" badge
- A **Miscellaneous** row showing the jazz-club spend instead of $0
- The amber warning naming the hotel and offering to add a real price
- Trip Total in the header rises accordingly and reconciles with the per-category sum