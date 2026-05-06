# Fix: Day 1 hotel check-in scheduled before hotel actually opens

## What's happening

For a 7:30 AM Paris landing, Day 1 schedules "Check-in at Four Seasons Hotel George V" at **9:45 AM**. Four Seasons (and most hotels) doesn't release rooms until 3:00 PM. The morning is built around a check-in that is physically not possible.

Root cause is in `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts`. Lines 47-51 compute the Day 1 sequence as:

```ts
const customsClearance = addMinutesToHHMM(arrival24, 60);
const transferStart   = addMinutesToHHMM(arrival24, 75);
const transferEnd     = addMinutesToHHMM(transferStart, 60);
const hotelCheckIn    = transferEnd;            // = arrival + 135 min
const settleInEnd     = addMinutesToHHMM(hotelCheckIn, 30);
```

The `isMorningArrival` and `isAfternoonArrival` branches (lines 117 and 184) both render this as a real **"Check-in at <hotel>"** activity at `hotelCheckIn`. The hotel's standard check-in time is never consulted, so the prompt instructs the model to put `Check-in` at e.g. 9:45 even though rooms aren't ready until 15:00.

The pattern for handling this is already implemented for the **no-flight + hotel** branch at lines 271-318: it calls the morning hotel stop a **"Luggage Drop"**, adds an explicit later **"Check-in at <hotel>"** activity at `standardCheckInTime` (15:00), and instructs the model to slot real activities between the two. We just need to apply the same pattern to the with-flight branches when `hotelCheckIn < standardCheckIn`.

## Fix

In `pipeline/compile-day-schema.ts`:

1. After computing `hotelCheckIn` (around line 50), derive a property-aware `standardCheckIn`:
   ```ts
   const standardCheckIn = (flightContext as any).hotelCheckInTime || '15:00';
   const standardCheckInEnd = addMinutesToHHMM(standardCheckIn, 15);
   const checkInIsTooEarly =
     hasHotelData &&
     (parseTimeToMinutes(hotelCheckIn) ?? 0) < (parseTimeToMinutes(standardCheckIn) ?? 900);
   ```
   Reuses the existing `flightContext.hotelCheckInTime` field already populated in `prompt-library.ts:33,212` and `compile-day-facts.ts:148/284/309`.

2. In the **morning arrival + hotel** branch (line 117) and the **afternoon arrival + hotel** branch (line 184), branch on `checkInIsTooEarly`:
   - **If too early** — render the existing 2-step + late-check-in sequence:
     1. `Arrival at <airport>` (unchanged)
     2. `Luggage Drop at <hotel>` from `transferEnd` to `transferEnd + 20m`. category `accommodation`. description: "Drop your bags and freshen up. Your room will be ready at `${standardCheckIn}`."
     3. (Inserted later, around `${standardCheckIn}`): `Check-in at <hotel>` from `${standardCheckIn}` to `${standardCheckInEnd}`. description: "Pick up keys, settle into your room."
   - **If not too early** (afternoon arrival landing after 14:00ish) — keep current "Check-in at <hotel>" at `hotelCheckIn`.

3. Update the `MORNING ARRIVAL GUIDELINES` / `AFTERNOON ARRIVAL GUIDELINES` blocks accordingly. The "earliest sightseeing" timestamp now derives from `transferEnd + 20m` (post-luggage-drop) when the bag-drop branch fires, so morning sightseeing can start sooner instead of waiting on the (impossible) check-in.

4. Mirror the fix to the `hotelCheckIn`-only paths in the placeholder hotel branch (line 152 — "no specific hotel selected"). Use the same `15:00` default.

5. Tag the synthetic activities so existing repair logic recognizes them:
   - Luggage Drop: `tags: ["bag-drop", "structural"]`, `category: "accommodation"`
   - Late Check-in: `tags: ["check-in", "structural"]`

   Verify (or extend) the **Itinerary Logistics Mandate** memory's bag-drop priority by checking `action-generate-trip-day.ts:1616` (`ACCOM_RE`) already includes `luggage drop` (it does — `luggage\s+drop` matches).

## No-fix areas

- The **all-day event** branch (line 63) intentionally late-checks-in after the event; do not change.
- The **evening arrival** branch (line 244) already lands after standard check-in; do not change.
- The **transition-day fallback** in `action-generate-day.ts:949-950` (`checkinStart = arrMins + 45`) is for inter-city same-trip arrival days, not first-day airport arrivals; out of scope (a future ticket can apply the same pattern).

## Tests

Add to `supabase/functions/generate-itinerary/scenario.test.ts` (or a new `compile-day-schema.test.ts` if there isn't one):

- Morning arrival 07:30 + hotel with no `hotelCheckInTime` → output prompt contains "Luggage Drop" and a separate "Check-in" at `15:00`.
- Morning arrival 07:30 + hotel with `hotelCheckInTime: '16:00'` → late check-in renders at `16:00`.
- Afternoon arrival 16:30 + hotel → single "Check-in" entry at `hotelCheckIn` (no luggage-drop split).
- Morning arrival 07:30 + no hotel → "Check-in at Your Hotel" still emitted at `15:00` after a luggage drop.

## Files

- `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts` — main change
- `supabase/functions/generate-itinerary/scenario.test.ts` (or sibling test) — coverage

No DB migration. No client changes. No memory change required (the **Itinerary Logistics Mandate** memory already covers bag-drop priority).
