## Bug

Day 3 (departure day) sequence:

```
17:50  Checkout from JW Marriott
~      Transfer to Airport      ← no time
19:35  Secluded Garden          ← post-checkout sightseeing
21:30  Farewell Stroll @ JW Marriott   ← back to a hotel they checked out of
22:15  Taxi to Airport
```

Two compounding failures: (1) a phantom untimed early "Transfer to Airport" card slips past the untimed-transport drop, and (2) post-checkout activities at a hotel the user has already left are not pruned.

## Root cause

**`supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

- **§8b** drops untimed departure-transport cards only when *both* `startTime` and `endTime` fail `^\d{1,2}:\d{2}$`. If the model emits a transfer card with a startTime but no endTime (or where end == start), it survives. The card then sets the "first transport" anchor for §11, which slides checkout to ~5:50 PM right before it.
- **§14** prunes only activities *after* the **last** departure card. With two departure-transport cards (early phantom + late real taxi), Garden + Stroll fall **between** them, so §14 leaves them in place.
- **No "post-checkout coherence" gate**: nothing enforces "after a hotel checkout, only logistics may follow" — and nothing detects that the 21:30 Stroll references the same hotel that was already checked out at 17:50.

The generator prompt's GRACEFUL FINISH directive caps activities at 90min ≤ transfer startTime but says nothing about checkout being the post-cap anchor when departure is in the evening.

## Fix (plan)

### 1. Tighten §8b untimed-transport drop
- Drop a departure-transport row when **any** of: missing startTime, missing endTime, end ≤ start, or start is more than `flightBufferMin + 60` minutes before `returnDepartureTime24` (i.e. an obviously-too-early transfer).
- Keeps the existing locked/userAdded/extracted exemptions.
- Sentinel: existing `DEPARTURE_TRANSPORT_UNTIMED` log; extend with reason (`untimed | inverted | too_early`).

### 2. New §14b — POST-CHECKOUT COHERENCE PRUNE
After §14 runs, walk activities once more on departure days:
- Find the **last** `accommodation` row whose title matches `checkout|check-out|check out` → `checkoutIdx`.
- For every activity at index > `checkoutIdx`:
  - **Keep** if classified as `flight | airport-transport | airport-security` (reuse §14 `classifyDep`).
  - **Keep** if `isLocked || userAdded || userEdited || extracted || pinned || isManual`.
  - **Drop otherwise**, with `repairs.push({ code: LOGISTICS_SEQUENCE, action: 'pruned_post_checkout_non_logistics', before: act.title })`.
- Special case: any kept logistics card whose `location.name` or title references the **just-checked-out hotel name** (case-insensitive substring) is acceptable for an airport transfer pickup, but a `Stroll | Walk around | Visit | Garden | Spa | Drinks` at that hotel is dropped (covered by the non-logistics rule above).

### 3. Re-run §11 swap after the new prune
After §14b, re-call `repairDepartureSequence(...)` so checkout snaps back to immediately precede the **real** departure transport (the late taxi), not the phantom early transfer that no longer exists.

### 4. Generator-side prompt directive
In `compile-prompt.ts`'s GRACEFUL FINISH section, append a hard rule:

> "On the final day of any city, hotel checkout is the last non-logistics activity. After checkout you may only emit airport/station transport, security/boarding, or the flight itself. Never schedule sightseeing, wellness, dining, or hotel-grounds activities after a checkout — even if there is time before departure. If the gap before departure is large, place checkout LATER (close to the departure-buffer window), not earlier."

This shifts model behavior so checkout naturally falls at `depTime − buffer − 30min` rather than mid-afternoon, and prevents the Garden/Stroll injection in the first place.

### 5. Tests
Add Deno test cases to `supabase/functions/generate-itinerary/pipeline/__tests__/repair-day.test.ts` (or create if missing — fall back to a focused `__tests__/post-checkout-prune.test.ts`):
- Two departure-transport cards (early untimed + late real) with Garden between → after repair: only late taxi remains, Garden pruned, checkout snapped before late taxi.
- Locked sightseeing card after checkout → preserved.
- Real flight day with proper single transfer → no spurious prune.

## Files touched
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (§8b tighten, §14b new, re-run §11, log sentinels)
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` (GRACEFUL FINISH directive)
- `supabase/functions/generate-itinerary/pipeline/__tests__/post-checkout-prune.test.ts` (new tests)
- `mem://constraints/itinerary/departure-day-graceful-finish` (extend with post-checkout coherence rule)

No DB migration needed — affected trips will fix on next refresh-day or regeneration.
