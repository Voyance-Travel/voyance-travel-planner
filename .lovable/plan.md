

## Fix: Pass Hotel Change Context to Single-Day Generation Path

### Problem
When a day is regenerated individually via `action-generate-day.ts`, the repair pipeline never receives `isHotelChange` or `previousHotelName`. This means checkout/check-in activities for split-stay hotel changes are never injected on single-day regeneration — even though the full-trip generation path (`action-generate-trip-day.ts`) handles this correctly.

Additionally, the hotel resolution in `action-generate-day.ts` (lines 828-854) always picks `rawHotel[0]` without date-aware matching, so split-stay days get the wrong hotel name.

### Changes

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`**

#### 1. Add date-aware hotel resolution for split-stays

Replace the simple `rawHotel[0]` logic (line 843) with the same date-aware resolution used in `generation-core.ts`:
- When `hotel_selection` is an array with multiple hotels, match by `checkInDate`/`checkOutDate` against the current day's date
- Fall back to evenly splitting nights across hotels if dates are missing

#### 2. Detect `isHotelChange` and `previousHotelName`

After resolving the correct hotel for the current day, also resolve the previous day's hotel:
- Walk the day→city mapping to find which hotel covered `dayNumber - 1`
- If the previous day's hotel name differs from the current day's hotel name (same city), set `isHotelChange = true` and `previousHotelName`

#### 3. Pass both fields to `repairInput`

Add `isHotelChange` and `previousHotelName` to the `RepairDayInput` object at line 858, matching what `action-generate-trip-day.ts` already does.

### Expected behavior
- Single-day regeneration on a hotel-change day will now inject:
  - **Checkout from Previous Hotel** (11:00–11:30)
  - **Check-in at New Hotel** (15:00–15:30)
- The correct hotel name is used for each day in a split-stay

### Files changed
- `supabase/functions/generate-itinerary/action-generate-day.ts` — date-aware hotel resolution, hotel change detection, pass to repair input

