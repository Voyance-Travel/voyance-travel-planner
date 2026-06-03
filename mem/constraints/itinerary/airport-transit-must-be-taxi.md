---
name: airport-transit-must-be-taxi
description: LLM-emitted airport transfers tagged as walks are forced to method=taxi with ≤45min duration via shared classifier; runs at repair-day §15z + save-time STEP 2.67
type: constraint
---

# Airport Transit Must Be Taxi

Closes recurring "Walk to Transfer to Airport — 1h 46m" leak. The LLM
occasionally emits an airport-bound transit card tagged `method: walk` —
nobody walks to an airport. The intra-city duration clamp in
`_shared/timing-cascade.ts::recomputeTransitCards` already shortens the
duration to 45 min when the title matches `isAirportish`, but it **never
changes the method**, and `sanitization.ts::enforceTransitModeByDistance`
only fires when both endpoints have coords (synthetic transfer cards
typically don't).

## Contract

Shared module `_shared/airport-transit-classifier.ts` exports:

- `isAirportTransitCard(card)` — true when:
  - `subcategory ∈ {'airport_transfer','transfer-to-airport'}`, OR
  - `category ∈ {transport,transit,logistics,transfer,transportation}` AND
    title/description matches `/\b(airport|terminal|to (?:the )?(?:airport|terminal))\b/i`
  - Flight cards (`category=flight`) and accommodation cards are always false.
- `enforceAirportTransitMode(card, { transferMinutes=45 })` — idempotent:
  - Forces `transportation.method = 'taxi'` when not already taxi/uber/car/shuttle/train/bus/metro.
  - Caps `durationMinutes` at `min(current, transferMinutes)` (never extends).
  - Rewrites title prefix `Walk|Stroll|Travel to …` → `Taxi to …`.
  - Stamps `metadata.airport_transit_classified = true` and `subcategory='airport_transfer'`.
- `enforceAirportTransitOnDay(activities, { transferMinutes, lockedIds })` —
  per-day sweep. Locked rows: only method is fixed (duration preserved).

## Wiring (3 sites)

1. `pipeline/repair-day.ts` `enforceDepartureDayLogistics` (§15z) — post-sort.
2. `action-save-itinerary.ts` STEP 2.67 — runs on every day (multi-city
   trips have airport transfers on transition days too).
3. (§15b coord-based recompute already skips when `subcategory='airport_transfer'`
   is set — the classifier's stamp doubles as a skip sentinel.)

Sentinel: `[Repair §15z] airport-transit method enforced on N card(s)` and
`[SAVE_AIRPORT_TRANSIT] day=N cards_fixed=K`.

Tests: `_shared/__tests__/airport-transit-classifier.test.ts` (7 cases).

## Departure card guarantee (added 2026-06-03)

§15z now ALSO guarantees a "Departure" boarding card on flight days, not just
the transfer. Root cause of the "Day 4 missing airport transit" pattern: the
LLM read the prompt's `DEPARTURE DAY ACTIVITIES: 1 maximum` cap and dropped
the REQUIRED SEQUENCE items 3–5 (optional activity, transfer, departure).
The §15z transfer-injection branch fired, but no equivalent existed for the
departure/boarding window.

Three reinforcements:

1. **Prompt copy harmonized.** `compile-day-schema.ts` all four flight-window
   branches (early/mid-day/afternoon/evening) now state that
   checkout+transfer+departure are REQUIRED with an explicit cap on the
   *optional* leisure cards, instead of `1 maximum` against a 5-step list.
2. **Flight-clock recovery in §15z.** When `returnDepartureTime24` is falsy
   (chat-planner trips, multi-city legs, save-time net path), §15z scans
   for an existing `category:'flight'` card on the day and recovers
   `depMins` from its `startTime`. Sentinel:
   `[Repair §15z] missing_flight_clock_recovered_from=input|flight-card|none`.
3. **Departure card injection (idempotent).** New shared predicate
   `isDepartureRow` matches `subcategory:'departure'`, `category:'flight'`,
   or title patterns `\bdeparture\b|\bboarding\b|check-in (?:and )?security`.
   Injection writes `{startTime: requiredAtAirport, endTime: depMins,
   category:'transport', subcategory:'departure',
   source:'repair-final-departure-enforce'}`. Skipped when an existing
   departure-class row sits within ±60min of `requiredAtAirport`, OR when
   any locked departure-class row is present.

Tests: `_shared/__tests__/departure-day-transfer-and-departure.test.ts`
(4 cases — early-flight injection, flight-card clock recovery, locked
respect, no-flight no-op). Existing `departure-day-combined.test.ts`
output now also includes the injected departure card.
