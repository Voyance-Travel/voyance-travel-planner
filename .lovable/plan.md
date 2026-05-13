## Bug

On Day 3 (departure) Osaka and Amsterdam show a synthetic "Return to {hotel} to wind down (overnight)" card at ~1:55 PM, after the airport transfer.

## Root cause

The "wind down (overnight)" string is only emitted by the read-time bookend (`src/lib/itinerary/ensureHotelReturnBookend.ts`, gray-zone branch). It has two departure-day defenses, both of which fail in this case:

1. `opts.isDepartureDay` — set by `src/utils/itineraryParser.ts` (Step 4b) by scanning each day's activities for an airport / flight / "Transfer to … airport|terminal|gate|station" card.
2. `(activities).some(isDepartureTerminal)` — same predicate, day-local.

Confirmed via DB: the canonical `itinerary_activities` table for both trips' Day 3 *does* contain `Travel to Airport` / `Transfer to Kansai International Airport (KIX)` / `Departure Flight`, **but the persisted `trips.itinerary_data.days[2].activities`** (the only thing the parser sees) does NOT — only `Breakfast`, `Anne Frank House`, `Checkout from … Marriott`, `Lunch …` (Amsterdam) and `Taxi to Osaka Central Public Hall`, `Explore Osaka Central Public Hall`, `Checkout from Four Seasons Hotel Osaka` (Osaka).

So the JSON-side day looks like a normal middle day whose last timed activity ends ~11:30 or ~13:30 → falls into the gray-zone `> 02:30 AND < 14:00` branch → fabricates a 13:55 "wind down (overnight)" card.

(The underlying JSON-vs-table divergence is a separate, larger persistence issue. The fix below is scoped to making the bookend logic resilient to that divergence — it's the one piece the user actually sees.)

## Fix (read-time only, no DB writes)

Add a third departure-day signal: **a `Checkout from {hotel}` card on the day**. Checkout is the unambiguous "we are leaving" anchor — if it's present, the day must not get a `Return to {hotel}` injected, regardless of whether the airport transfer/flight survived into the JSON.

### `src/lib/itinerary/ensureHotelReturnBookend.ts`
- Extend `isDepartureTerminal(a)` to also return `true` when the card matches `CHECKOUT_RE` (the regex already exists in the file). This makes the existing day-local defense (line 205, `.some(isDepartureTerminal)`) catch the Amsterdam/Osaka case directly. New skip reason: `reason=day_contains_checkout`.
- No change to `isTerminalAlready` — checkout already counts there, so the post-selection guard keeps working.

### `src/utils/itineraryParser.ts` (Step 4b, `dayHasDepartureTerminal`)
- Mirror the addition: a day whose activities include a `category === 'accommodation'` row whose title matches `^\s*check[-\s]?out\b` is a departure day.
- Belt-and-braces fallback: if no day matched after the scan, set `departureDayIdx = result.length - 1` so the trip's final day is always treated as departure even when both the airport transfer AND the checkout were stripped from the JSON.

### Tests
- `src/lib/itinerary/__tests__/ensureHotelReturnBookend.test.ts`: add Amsterdam Day-3 case (Breakfast 08:30, Anne Frank 10:30–12:00, Checkout 11:00–11:30, Lunch ?–13:30) → expect input returned unchanged, sentinel `reason=day_contains_checkout` logged.
- Add Osaka Day-3 case (Taxi 09:35, Explore 09:52–11:07, Checkout 11:22–11:52) → same.

### Memory
- Update `mem://constraints/itinerary/read-time-hotel-return-bookend` to note that **checkout presence is a departure-day signal** equivalent to flight/airport-transfer, and that the parser falls back to "last day = departure" when neither is detected.

## Out of scope

- Healing the JSON-vs-table divergence (why airport transfer + flight rows are absent from `trips.itinerary_data.days[2]` for these trips). That's the persistence-truth issue tracked separately under the resync memories — large blast radius, not what the user reported.
- Backend `runStep8` (no evidence it's emitting; the offending string is read-time-only).
- Any change to checkout/flight card writers.

## Files

- `src/lib/itinerary/ensureHotelReturnBookend.ts` — extend `isDepartureTerminal`.
- `src/utils/itineraryParser.ts` — extend `dayHasDepartureTerminal`, add last-day fallback.
- `src/lib/itinerary/__tests__/ensureHotelReturnBookend.test.ts` — Amsterdam + Osaka cases.
- `mem://constraints/itinerary/read-time-hotel-return-bookend` — document checkout signal + last-day fallback.
