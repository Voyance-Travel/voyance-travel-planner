

## Fix: Hotel Switch (Split-Stay) Checkout/Check-in Inconsistencies

### Problems Identified

There are **5 bugs** causing inconsistent behavior on hotel-change days (`isHotelChange = true`):

#### 1. Morning phantom strip removes checkout on hotel-change days
The morning phantom strip (line 1323) runs on all non-first, non-departure days. On a hotel-change day, the traveler wakes up at the **previous** hotel, needs to **checkout**, then **check-in** at the new hotel. But the phantom strip sees the checkout as an accommodation card at the start of the day and removes it — it only checks `!isCheckinOrCheckout` but this may not save it if the AI generated a "Return to Hotel" before the checkout.

**Fix**: Pass `isHotelChange` into `repairBookends` and skip the morning phantom strip entirely on hotel-change days. The checkout is legitimate on these days.

#### 2. Check-in injection uses wrong time for hotel-change days
When `isHotelChange` is true, the check-in is injected via `unshift` at the very start of the day (line 573) with a time of `max(12:00, firstActivity - 45min)`. But on a hotel-change day, checkout happens first (morning), then exploration, then check-in at the NEW hotel mid-afternoon. The check-in should come AFTER the checkout, not before it.

**Fix**: On hotel-change days, insert check-in AFTER the checkout activity rather than at position 0. Use a time ~30min after checkout ends, or default to 15:00 if no checkout found.

#### 3. Checkout and check-in ordering: checkout runs AFTER check-in in pipeline
Step 7 (check-in guarantee) runs before Step 8 (checkout guarantee). On hotel-change days, this means the check-in is injected first (at position 0), then checkout is inserted chronologically. This creates a fragile ordering where checkout might end up after check-in depending on times.

**Fix**: On hotel-change days, ensure checkout is injected FIRST (swap order for this case), then check-in is placed after it.

#### 4. Title normalization overwrites checkout hotel name
Step 9b normalizes ALL accommodation titles to use `hotelName` (the NEW hotel). But on hotel-change days, the checkout should reference `previousHotelName`. The normalization at line 822 rewrites `Checkout from Previous Hotel` → `Checkout from New Hotel`.

**Fix**: Pass `previousHotelName` and `isHotelChange` to the normalization step. Skip normalizing checkout titles when `isHotelChange` is true (they already have the correct previous hotel name from Step 8).

#### 5. Bookend "Return to Hotel" injected at end of hotel-change day uses wrong context
`repairBookends` doesn't know about `isHotelChange`, so the end-of-day "Return to Hotel" card is created correctly (uses `hotelName` = new hotel). But mid-day freshen-up could be incorrectly injected between checkout and check-in, when the traveler has no hotel to go to.

**Fix**: Pass `isHotelChange` context to `repairBookends`. Between checkout and check-in on hotel-change days, suppress mid-day hotel return injection.

### Changes

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

#### A. Update `repairBookends` signature to accept `isHotelChange`

Add `isHotelChange` and `previousHotelName` parameters.

#### B. Skip morning phantom strip on hotel-change days

In step 0 of `repairBookends` (line 1323), add `&& !isHotelChange` to the guard. The traveler needs the morning checkout.

#### C. Fix check-in/checkout ordering for hotel-change days (Steps 7 & 8)

Restructure Steps 7 and 8: when `isHotelChange` is true:
1. Run checkout injection FIRST (from `previousHotelName`, morning time ~10:00-11:00)
2. Run check-in injection SECOND, placed AFTER the checkout (afternoon time ~15:00)
3. Do NOT `unshift` check-in — insert it chronologically after checkout

#### D. Protect checkout title in normalization (Step 9b)

When `isHotelChange && previousHotelName`, skip the checkout normalization so the previous hotel name is preserved. Only normalize non-checkout accommodation titles to the new hotel name.

#### E. Suppress mid-day hotel return between checkout and check-in

In `repairBookends` step 1b, when `isHotelChange`, skip mid-day freshen-up injection if it would fall between checkout time and check-in time (traveler has no hotel during this window).

### Expected behavior after fix

| Sequence | Hotel-change day |
|---|---|
| Morning | Breakfast → **Checkout from Previous Hotel** |
| Mid-day | Exploration (no hotel returns — you have no hotel yet) |
| Afternoon | **Check-in at New Hotel** → Freshen Up |
| Evening | Dinner → **Return to New Hotel** |

### Files changed
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`

