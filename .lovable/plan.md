# Last-Day Departure-Flight Truth Stamper

## Evidence

Pulled `itinerary_days` for trip `ab83230a-da60-47f1-94bf-61c11002d183`:

- Day 1 flight card: ✅ correct — `Arrival Flight 22:30→23:15`, `source:'stamp-arrival-truth'`, `anchorSource:'arrival-flight'`, `isLocked:true`.
- Day 4 flight card: ❌ `Departure Flight 01:35→02:04`, no `anchorSource`, no `source` tag, no lock — the LLM invented this time. Real return is 21:00 PM (DUB→ATL Jun 18).

Day 4 has 1 flight card, no other anchors except this hallucinated one. Meal repair sees a "flight at 01:35 AM" anchor and (correctly) refuses to inject meals into a 24h block that the schedule says is dominated by a pre-dawn flight. Once the card is moved to its real 21:00 slot, the day becomes `checkout 7AM → ~14h open → transfer ~17:00 → flight 21:00`, and existing meal-injection logic in `repair-day.ts` §9 will fill breakfast / lunch / pre-departure dinner unaided.

The user's hypothesis (timezone bleed in `compile-day-facts.ts`) does **not** match the data — `compile-day-facts.ts` does not emit activity cards; it builds `flightContext` text and the meal policy. The leak is purely the LLM choosing a wrong time, identical in shape to the Day-1 arrival mismatch we already closed with `stampArrivalAnchorTruth`.

## Fix — single defense layer, mirror of arrival stamper

### 1. New shared module `_shared/stamp-departure-anchor-truth.ts`

Mirror of `stamp-arrival-anchor-truth.ts`:

- `isDepartureFlightCard(a)` — multi-signal detector:
  - `anchorSource === 'departure-flight'`, OR
  - `tags` includes `departure-flight`, OR
  - `category ∈ {flight, transport, logistics}` AND title matches `\b(departure|outbound|return)\b.*\bflight\b` or `flight home` or `board(ing)? .* flight`.
- `stampDepartureAnchorTruth(day, { isLastDay, departureTime24, departureAirport, boardingLeadMins=45 })`:
  - No-op when `!isLastDay`, `!departureTime24`, or invalid HH:MM.
  - No-op when no departure-flight card found.
  - Otherwise overwrite `startTime = departureTime24 − boardingLeadMins` (boarding gate), `endTime = departureTime24` (wheels-up). Mirror onto `start_time`/`end_time`/`time`. Stamp `isLocked=true`, `lockReason='flight-truth'`, `anchorSource='departure-flight'`, `source='stamp-departure-truth'`. Preserve title/description/cost.
  - Idempotent: skip mutation if already aligned and stamped.
- Export `stampDepartureAnchorTruthOnDays(days, input)` convenience over `days[days.length-1]`.

### 2. Wire into the same boundaries the arrival stamper uses

Three call sites, immediately after the LLM response is parsed, before validate/repair:

- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — next to the existing `stampArrivalAnchorTruth(dayMinimal, …)` call (~line 1658). Gate on `isLastDay = dayNumber === totalDays`. Pass `departureTime24 = flightContext.returnDepartureTime24`, `departureAirport = flightContext.departureAirport` (or fallback).
- `supabase/functions/generate-itinerary/action-generate-day.ts` — next to the existing call (~line 1007). Same gating.
- `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts` — next to the existing call (~line 209). Same gating.

Log a single `[STAMP_DEPARTURE_TRUTH]` sentinel (action, was/new times, card index) for every invocation, mirroring the arrival-stamp log format.

### 3. Memory update

Extend `mem/constraints/itinerary/flight-anchor-truth-parity.md` with a "Departure Anchor Truth" section that documents the new shared module, the 3 wiring sites, the `[STAMP_DEPARTURE_TRUTH]` sentinel, and the failure mode it closes (LLM-hallucinated pre-dawn departure flight starving meal repair).

## Out of scope

- `compile-day-facts.ts` — confirmed not the leak source; no change.
- `repair-day.ts` meal-injection logic — works correctly once the anchor is truthful.
- `repair-day.ts` §6 LOGISTICS_SEQUENCE — independent concern.
- Day-1 missing dinner on a 22:30 arrival — correctly skipped per existing policy; no change.

## Verification

- Re-run on trip `ab83230a-da60-47f1-94bf-61c11002d183` (or a fresh trip with a known return-departure): Day 4 should show `Departure Flight 20:15→21:00` (with `boardingLeadMins=45`) and 3 meals injected.
- Existing tests for `stampArrivalAnchorTruth` style — add a parallel test file `__tests__/stamp-departure-anchor-truth.test.ts` with (a) no-op when not last day, (b) overwrite when card present, (c) idempotent on second call.
