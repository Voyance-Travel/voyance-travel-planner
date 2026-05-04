## Problem

Day 1 shows **"Check-in at Four Seasons" at 09:45** even though the hotel's stated check-in is **15:00**. The card calls itself a check-in (with a 30-min "check-in window") and the description says "early luggage storage usually available", but the headline still implies the room is ready. A luxury traveler expects accuracy — they will arrive at 9:45 expecting a room and won't get one.

The card is generated three different ways (all currently broken on this case):

1. `compile-day-schema.ts` (no-flight prompt blocks at lines 285–336) hard-codes step 2 as `"Check-in at <hotel>"` regardless of the hotel's actual `checkInTime`.
2. `generation-core.ts` line 687 has the right rule ("title it Luggage Drop at {Hotel} when arriving before checkInTime") but the model often ignores it.
3. `injectHotelActivities.ts` line 33 builds a hard-coded `"Check-in at <hotel>"` accommodation card.
4. `repair-day.ts` line 1430 (mid-trip hotel change) does the same.

None of them check whether the scheduled time is actually ≥ the hotel's `checkInTime`.

## Fix

Three layers, defensive.

### 1. Read-time safety net — `EditorialItinerary.tsx`

In the `days` useMemo, after the existing arrival-placeholder filter, add a relabel pass: for each Day 1 (or first-day-in-city) accommodation activity whose title starts with `Check-in` AND whose `startTime < effectiveHotelSelection.checkInTime`, rewrite it in place to:

- title: `Luggage Drop at <hotel>`
- description: `Drop your bags and freshen up. Your room will be ready at <checkInTime>.`
- duration cap: 20 min (was 30)
- keep `category: 'accommodation'`, keep ID, keep location

Skip if `locked || isLocked` (Universal Locking). This handles every existing trip immediately, no migration.

### 2. Generator prompt — `compile-day-schema.ts`

In both no-flight blocks (lines 287–304 and 318–335), choose the title at template time based on whether `transferEnd < checkInTime`:

```text
const isBeforeCheckin = parseTime(transferEnd) < parseTime(hotel.checkInTime ?? '15:00');
const title = isBeforeCheckin ? `Luggage Drop at ${hotel}` : `Check-in at ${hotel}`;
const desc  = isBeforeCheckin
  ? `Drop bags and freshen up. Your room will be ready at ${checkInTime}.`
  : `Check in and get settled.`;
```

When `isBeforeCheckin` is true, also append a short instruction so the model adds an explicit `"Check-in at <hotel>"` accommodation activity at `checkInTime` (15-min) before evening activities. That gives the user the full timeline: bag drop → day → real check-in → dinner.

### 3. Helper utilities — `injectHotelActivities.ts` and `repair-day.ts`

`buildCheckInActivity` (line 33) already receives `hotel.checkInTime`. Change it to accept a scheduled `startTime` arg; if `startTime < checkInTime`, build a "Luggage Drop" activity instead. The repair-day mid-trip hotel-change branch (line 1430) gets the same conditional.

## Why this is safe

- Read-time relabel is purely cosmetic (title + description + duration); IDs, costs, locations untouched. Cost ledger, Payments, locking all unaffected.
- Locked activities are skipped — manual edits are preserved (Universal Locking memory).
- When `checkInTime` is unknown we keep current behavior (default 15:00 still gates the rename, so the most common luxury hotels behave correctly).
- Generator changes only alter *future* generations; existing trips rely on the read-time net.

## Files touched

- `src/components/itinerary/EditorialItinerary.tsx` — relabel pass inside the existing Day 1 `days` useMemo (~25 lines).
- `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts` — conditional titles + add explicit later check-in step (~25 lines across two blocks).
- `src/utils/injectHotelActivities.ts` — `buildCheckInActivity` accepts scheduled time, branches title/description (~15 lines).
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — mid-trip hotel-change card uses the same gate (~10 lines).

## Verification

- Existing trip with 09:45 "Check-in at Four Seasons" reloads as **"Luggage Drop at Four Seasons — Drop bags and freshen up. Your room will be ready at 15:00."**
- New trip without flight, hotel checkInTime=15:00 → opening sequence reads Transfer → Luggage Drop → … → Check-in at 15:00 → dinner.
- Trip arriving at 16:00 (after checkInTime) → still says "Check-in at <hotel>" exactly as before.

Approve to ship.