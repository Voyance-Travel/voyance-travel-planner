

## Problem: Last Day / Checkout Rules

### Root Cause

The repair pipeline in `repair-day.ts` has a structural ordering problem on departure days:

1. **Step 7 (bookends)** runs unconditionally and injects "Return to Hotel" at end-of-day if the last visible activity isn't accommodation. On the last day, the last activity is typically a flight — so it injects a "Return to Hotel" card AFTER the flight. This is nonsensical for a departure day.

2. **Step 10 (checkout guarantee)** then injects checkout chronologically, but at this point the day already has a conflicting "Return to Hotel" at the end.

3. **Step 11 (departure sequence fix)** tries to swap checkout before airport, but the day structure is already muddled by the erroneous end-of-day return injection.

4. The mid-day freshen-up injection (bookend step 1b) also fires on departure days, potentially inserting a hotel return between checkout and airport transfer — breaking the departure chain.

### What to Change

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

1. **Skip end-of-day hotel return on departure days** — In the `repairBookends` function (line ~843), add a guard: if `isLastDay` (or the day has airport/flight activities), do NOT inject "Return to Hotel" at end of day. Pass `isLastDay` and `isLastDayInCity` into `repairBookends`.

2. **Skip mid-day freshen-up injection on departure days** — The lunch-dinner gap logic (line ~824) should not fire when the day contains checkout + airport cards, as travelers won't be going back to the hotel between checkout and departure.

3. **Run checkout guarantee BEFORE bookends** — Move step 10 (checkout injection) above step 7 (bookends), so the day already has checkout when bookends run. This prevents bookends from injecting conflicting accommodation cards.

4. **Run departure sequence fix AFTER checkout guarantee** — The current ordering (step 6 → step 7 → step 10 → step 11) should become: step 6 → step 10 → step 7 (with last-day guard) → step 11. This ensures checkout exists before departure reordering happens.

### Execution Order (revised)

```text
Current:                          Proposed:
6. LOGISTICS_SEQUENCE             6. LOGISTICS_SEQUENCE
7. Bookends (hotel return)        9. CHECK-IN GUARANTEE (unchanged)
8. TITLE_LABEL_LEAK              10. CHECKOUT GUARANTEE (moved up)
9. CHECK-IN GUARANTEE             7. Bookends (with last-day guard)
10. CHECKOUT GUARANTEE             8. TITLE_LABEL_LEAK
11. Departure swap                11. Departure swap
```

### Expected Result

- Last day: breakfast → checkout → (optional morning activity) → airport transport → security → flight. No "Return to Hotel" after flight.
- Non-last days: unchanged — still get mid-day freshen-up and end-of-day return.
- Checkout is guaranteed on last day and placed correctly in the departure chain.

