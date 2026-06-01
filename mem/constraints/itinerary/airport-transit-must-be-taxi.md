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
