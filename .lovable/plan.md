## Problem

For a flight landing at 20:00 (BCN), the Day 1 "Arrival Flight" card renders as **18:00–20:00**. The current convention treats the card as a 120-minute in-flight window that *ends* at landing time. Users expect the card to *start* at the landing time (the moment the activity becomes real to them — wheels-down, deplane, customs, baggage).

## Root cause

`supabase/functions/generate-itinerary/pipeline/repair-day.ts` §3b (around lines 978–1074), the only writer of the `arrival-flight` anchor:

```ts
const flightEndMins   = arrivalMins;              // 20:00
const flightStartMins = Math.max(0, arrivalMins - 120);   // 18:00
```

Both the RECONCILE branch (overwriting an LLM-emitted card) and the INJECT branch (creating one fresh) use this 120-min-pre-landing window. The transfer is then anchored at `flightEnd + 30` (i.e. landing + 30).

A matching workaround exists in the UI: `FlightSyncWarning` (EditorialItinerary.tsx ~9832–9848) comments out the 2h drift by comparing flight arrival against the card's **endTime** when the card is the `arrival-flight` anchor — proof the convention has been confusing.

## Fix — flip the convention so the card starts at landing

Day 1 "Arrival Flight" anchor becomes a short on-ground window pinned to the landing moment:

- `startTime` = `arrivalTime24` (landing, e.g. 20:00)
- `endTime`   = landing + `airportProcessingMinutes` (default **45 min**: deplane + immigration + baggage)
- `durationMinutes` = same 45
- Title stays "Arrival Flight"; description nudged to `Land at {airport}, clear customs, collect bags.`
- Transfer card start = flight end (no extra +30 buffer — the 45-min on-ground window already covers it). Transfer end = start + `airportTransferMinutes`.

### Files to change

1. **`supabase/functions/generate-itinerary/pipeline/repair-day.ts`** (§3b, ~975–1115)
   - Replace the two lines above with `flightStartMins = arrivalMins` / `flightEndMins = arrivalMins + AIRPORT_PROCESSING_MINS` (45, sourced from `input.airportProcessingMinutes ?? 45`).
   - `transferStartMins = flightEndMins` (drop the extra +30).
   - Update `durationMinutes` on both branches to the new value.
   - Refresh the description default + the `[Repair §3b]` log line.

2. **`src/components/itinerary/EditorialItinerary.tsx`** — `FlightSyncWarning` (~9806–9870)
   - Drop the `isArrivalFlightAnchor → endTime` branch; always compare flight arrival against the card's **`startTime`** (now they're the same value by construction).
   - Tighten the alignment tolerance back to ±5 min vs `flightMins` (no `expectedEarliest +105` buffer for the anchor card itself).

3. **Verification — read-only checks (no edits)**
   - `_shared/timing-spine.ts` `chronoSortKey` already pins `arrival-logistics` to the day head via the anchor source tag, not by clock value — landing-time start (20:00) won't reorder it.
   - `_shared/sanitize-schedule-timing.ts` + `_shared/predawn-cascade-normalize.ts` exempt `anchorSource === 'arrival-flight'` and `source === 'repair-arrival-flight*'` — the 20:00 start won't trip the pre-dawn cascade.
   - `_shared/bookend-verification.ts` arrival-flight identity is anchor-tag-based, not time-based.

4. **Tests**
   - Update `_shared/__tests__/arrival-flight-reconcile.test.ts`, `arrival-flight-anchor.test.ts`, and `sanitize-schedule-timing.test.ts` expectations from `${arrival−120}-${arrival}` to `${arrival}-${arrival+45}`.
   - Add a regression: input `arrivalTime24='20:00'` → flight card `startTime='20:00'`, `endTime='20:45'`, transfer `startTime='20:45'`.

5. **One-shot heal for already-persisted trips**
   - Migration that, for every `itinerary_activities` row with `source IN ('repair-arrival-flight','repair-arrival-flight-reconciled','injected-arrival-flight')` and a co-located flight selection: rewrites `start_time = end_time` and `end_time = end_time + interval '45 min'`. Mirror into `trips.itinerary_data` JSONB via a follow-up RPC pass (idempotent — skip if `start_time >= end_time - interval '50 min'`).
   - Stamp `metadata.quality.arrival_flight_convention_v2 = true` so the heal is single-shot.

## What stays the same

- The transfer card and downstream post-arrival cascade still anchor off `flightEndMins` — only the start point shifts, so existing "earliest post-arrival activity = transferEnd + 15" math is preserved.
- Locked/anchor/cost/category fields, ID schemes, and parser/health code paths are all anchor-tag keyed; none of them read the 120-min window literally.
- No user-facing copy changes besides the card's own description string.

## Out of scope

- Return / departure flight card timing (separate convention, separate user reports).
- Adding a configurable "show flight number / origin" string to the card body.
