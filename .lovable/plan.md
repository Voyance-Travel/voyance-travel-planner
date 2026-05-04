# Fix: Activity items disappeared (31→15) and hotel duplicated in Essentials

## Root causes

### A. Activity items dropped from 31 to 15

`src/hooks/usePayableItems.ts` was reworked so activity rows are derived **exclusively** from the `activity_costs` DB table (the JSON-walk + `estimateCostSync` fallback was deleted — see the file's top comment dated May 2026).

For this trip (`7ea828ac…`), `activity_costs` only contains ~25 rows. The displayed JSON itinerary has many more activities. Anything not yet costed in `activity_costs` (or stored as $0 — the loop continues on `cents <= 0`) is invisible. So the count collapsed to whatever the DB happened to have written, not what the user sees on the days.

### B. Travel Essentials jumped to $5,250 (duplicate hotel)

The trip has both:
1. A manual payment row: `item_type='hotel'`, `item_id='manual-…'`, `$2,400`.
2. A canonical `activity_costs` row: `category='hotel'`, `day_number=0`, `$2,850` (auto-written by the hotel-ledger sync).

The guard in `usePayableItems` only suppresses the canonical day-0 hotel when a manual hotel exists — **but only inside the `hotelSelection` branch (lines 175-213)**. The hotel ledger row also feeds `useTripFinancialSnapshot` (used elsewhere), and the day-0 row leaks back into "Essentials" totals via the `essentialItems` reducer if any code path emits it as an item. In addition, a transient render before `payments` loads (`hasManualHotel` is briefly false) lets the canonical row through and it stays visually duplicated until next refetch.

## Fix

### 1. Restore the JSON-walk fallback for activity items
File: `src/hooks/usePayableItems.ts`

- After the `activity_costs` loop, walk `days[].activities` and emit a payable item for any activity whose `id` is **not** already represented in the result list.
- Use `estimateCostSync` (already imported elsewhere as `@/lib/cost-estimation`) with the same `travelers / budgetTier / destination / destinationCountry` props the hook already accepts but currently ignores. Skip activities whose estimated cents <= 0 *and* whose name matches the free-venue heuristic, otherwise still surface them at $0 so users see the line item.
- Keep the transit grouping behavior (per-day rollup) for any walk-derived transport rows.

This restores the original "one row per scheduled activity" UX while still letting the DB-side `activity_costs` win the price when present.

### 2. Harden the hotel-override suppression
File: `src/hooks/usePayableItems.ts`

- Move `hasManualHotel` / `hasManualFlight` detection to be **case-insensitive** and tolerant of whitespace in `item_id` (`/^manual[-_]/i.test(p.item_id)`).
- Guard the `result.push` for the day-0 canonical hotel/flight rows in **all** code paths (both the `hotelSelection` UI branch and the `activityCosts` fallback branch) behind a single check that re-asserts `!hasManualHotel`.
- Add a final post-processing dedupe: if the result list contains both a `type==='hotel'` item with `id==='hotel-selection'` and a manual hotel item, drop the `hotel-selection` one. Same for flights.

### 3. Avoid the brief render-before-payments-load duplicate
File: `src/components/itinerary/PaymentsTab.tsx`

- The `payments` state initializes to `[]` while `getTripPayments` resolves; during that window `hasManualHotel === false` and the canonical row renders. Add a `paymentsLoaded` boolean (set true inside `fetchPayments` after `setPayments`) and pass it to `usePayableItems`. While `paymentsLoaded === false`, the hook returns `items: []` (or just suppresses canonical hotel/flight rows) so we never flash the duplicate.

## Out of scope

- No schema changes.
- No edits to `useTripFinancialSnapshot` (header/budget reconciliation already passes the override-aware total).
- No change to the manual-expense insert flow.

## Acceptance

- Reload the Payments tab on the affected trip:
  - **Activities & Experiences** count returns to ≥ the number of bookable activities visible in the itinerary (not just the costed-in-DB subset).
  - **Travel Essentials** shows exactly one hotel row at $2,400 (the manual entry); total is $2,400, not $5,250.
- A trip with no manual hotel still shows the canonical hotel row from `hotelSelection` / `activity_costs` once.
- "Reconciling…" badge does not return to a stuck state.
