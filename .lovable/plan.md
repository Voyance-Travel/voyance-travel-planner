

## Fix: Hotel Check-in Guarantee for Regenerated Days

### Issue 1: Credits for Regeneration
Credits **are already being charged**. The `requestDayRegenerate` function (line 3462-3476 of `EditorialItinerary.tsx`) calls `spendCredits.mutateAsync({ action: 'REGENERATE_DAY' })` before triggering the actual regeneration. The backend `spend-credits` function charges 10 credits per regeneration with a free cap (1 free for free/flex users). This is working correctly.

### Issue 2: Day 1 Regeneration Missing Hotel Check-in
**Root cause**: Stage 2.56 (the hotel check-in guarantee we just added) only runs during **full trip generation**. The `generate-day` / `regenerate-day` action path (starting at line ~6450) has its own independent code path that returns the generated day directly — it never passes through Stage 2.56.

The AI prompt does include Rule 12 ("Day 1 MUST begin with Hotel Check-in") when `isFirstDay` is true, but there's no deterministic enforcement if the AI ignores it.

### Fix

**File**: `supabase/functions/generate-itinerary/index.ts`

Add a post-generation hotel check-in guarantee in the `generate-day`/`regenerate-day` path, right before the response is returned (around line ~9190, after must-do validation and before the `return new Response`).

The logic mirrors Stage 2.56 but scoped to single-day regeneration:

1. **If `dayNumber === 1`** (arrival day): Check if the generated activities include an accommodation check-in. If not, inject one before the first activity, using hotel info from `flightHotelResult` or `trip_cities`.

2. **If it's a multi-city transition day** (first day in a new city): Same check — if no check-in activity exists, inject one with the correct city's hotel name.

3. **Hotel name resolution**: Load hotel info the same way the full generation does — from `trip_cities.hotel_selection` for multi-city, or from the trip's flight/hotel context for single-city.

The check-in detection logic (keyword matching on title + category) is identical to Stage 2.56: look for `category === 'accommodation'` with title containing "check-in", "check in", "checkin", "settle in", or "hotel".

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Add post-generation check-in guarantee in `generate-day`/`regenerate-day` path (~line 9189) |

