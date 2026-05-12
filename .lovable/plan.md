## Why your hotel total is missing

You entered the hotel + nightly price + checked "include" in **Step 2 of the planner** (`src/pages/Start.tsx`). When the trip is created, three things are written to the database:

1. `hotel_selection` JSON (name, price-per-night, etc.)
2. `budget_include_hotel = true` (the toggle you flipped)
3. **No row in `activity_costs`** for the hotel.

Trip totals are read from `activity_costs` by the resolver in `src/services/canonicalCostRows.ts`. With no hotel row, hotel cost = $0 in the total. The `EditorialItinerary` mount-effect is *supposed* to back-fill that row by calling `syncHotelToLedger` once on first view — but it silently produces $0 (or only one night) for trips that came out of Step 2 because:

- Step 2's single-hotel write at `Start.tsx` lines 2413–2421 stores `pricePerNight` but **omits `checkInDate` / `checkOutDate` / `nights` / `totalPrice`**.
- `syncHotelToLedger` → `computeHotelCostUsd` then has nothing to multiply by, so it falls through to `pricePerNight × Math.max(1, daysCount−1)` with `daysCount=1`, which gives only one night (and for split-stay arrays often gives 0 because dates are missing on most entries).

Net result: even with "include in budget" checked, the hotel either contributes nothing or one night to the total.

## Fix

Two small, surgical changes — no logic refactor, no UI redesign.

### 1. `src/pages/Start.tsx` — write complete hotel data

In the trip-insert block (around lines 2392–2425):

- For the single-hotel branch (legacy, `manualHotel.name` only), also write `checkInDate = trip.start_date`, `checkOutDate = trip.end_date`, and a derived `totalPrice = pricePerNight × nights`.
- For the multi-hotel branch (`manualHotelList`), for any entry that has `pricePerNight` but no `checkInDate`/`checkOutDate`, fill them in by evenly partitioning the trip range across the list (same heuristic the generator already uses at `generation-core.ts` ~line 450). Compute and persist `totalPrice` per entry.
- Immediately after `supabase.from('trips').insert(...)` succeeds and we have `trip.id`, when `includeHotelInBudget` is true call `syncHotelToLedger(trip.id, primaryHotel)` (single) or `syncMultiCityHotelsToLedger(trip.id, entries)` (split-stay / multi-city). Do not wait for the user to land on `TripDetail` for the back-fill to fire.

### 2. `src/services/budgetLedgerSync.ts` — defensive fallback

In `syncHotelToLedger`, when `totalUsd` resolves to 0 but `hotel.pricePerNight > 0`, look up the trip's `start_date`/`end_date` (one extra `select`) and recompute as `pricePerNight × nightsBetween(start, end)` before giving up and calling `removeLogisticsCost`. This guarantees that any older trip already in the database gets healed on next view by the existing `EditorialItinerary` mount-effect, without users needing to re-enter the hotel.

### Verification

- Create a fresh trip via Start → Step 2 → enter hotel name, $/night, check "Include in budget" → generate. Open `Payments` tab and the trip header total: hotel line should appear as `pricePerNight × nights` and be folded into the total.
- Pre-existing affected trip: just open it once. The mount-effect + new fallback in `syncHotelToLedger` will write the hotel row to `activity_costs`; total updates on the next snapshot tick.
- `psql` check: `select category, total_cost_cents from activity_costs where trip_id='…' and category='hotel';` should return one row.

## Files touched

- `src/pages/Start.tsx` — enrich hotel write + eager sync call (≈ 25 lines).
- `src/services/budgetLedgerSync.ts` — date-range fallback in `syncHotelToLedger` (≈ 15 lines).

No schema changes, no edge function changes, no new flags. Existing tests in `src/services/__tests__/budgetLedgerSync.test.ts` cover the manual-payment guard; I'll add one case for the "no dates, fall back to trip span" branch.
