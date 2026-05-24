# Auto-tag flight legs by direction

## Problem

On the flight editor / inline booking add screen, every leg shows **both** buttons:
- "Mark as destination arrival"
- "Mark as departure from destination"

The system already knows which leg is outbound and which is return — that context is in `legType` (in `MultiLegFlightEditor`) and in the leg order + airport codes vs the trip's destination IATA everywhere else. We're asking the user to declare something the data already implies.

Downstream code (`getFirstLegArrivalTime`, `pickDestinationArrivalLeg`, Day 1 timing) prefers the explicit `isDestinationArrival` / `isDestinationDeparture` flag and falls back to "leg 0" / "last leg" heuristics when it's missing. The fallback is fragile — multi-leg trips with a layover land on the wrong leg, and the new Issue 1 fix for Day 1 arrival reads cleaner when the flag is actually set.

## Fix

Auto-stamp the flags whenever they can be unambiguously inferred, and hide the irrelevant button on legs where it can't apply. User can still toggle to override (layovers, codeshares, weird routings).

### 1. Shared inference helper — `src/utils/normalizeFlightSelection.ts`

Add `autoTagLegs(legs, tripDestinationIata?)` that returns the same array with flags stamped:

- **Single destination round-trip (2 legs, no inter-city):**
  - If neither leg has `isDestinationArrival`, mark leg 0.
  - If neither leg has `isDestinationDeparture`, mark the last leg.
- **Single leg (one-way):**
  - Mark `isDestinationArrival=true`.
- **3+ legs (with destination IATA available):**
  - Mark the leg whose `arrival.airport === tripDestinationIata` as arrival.
  - Mark the leg whose `departure.airport === tripDestinationIata` (and is the latest such leg) as departure.
  - If destination IATA missing or no match, fall back to second-to-last for arrival, last for departure (current heuristic).
- **Never overwrite a user-set flag** — only fill blanks.
- Ensure mutual exclusivity per category (only one arrival flag, only one departure flag).

### 2. Wire auto-tag at the data boundaries

Run `autoTagLegs` once at these write sites so the stamped flags persist:

- `src/components/planner/flight/MultiLegFlightEditor.tsx` — in the `emittedLegs` build path (~line 568) before `onLegsChange` fires. Pass `destinations[destinations.length-1].airportCode` as the destination IATA hint. Also use `legType` ('outbound' → arrival, 'return' → departure) as a stronger signal than airport matching.
- `src/components/itinerary/AddBookingInline.tsx` — in the save path that builds `legObjs` (~line 270) before persisting.
- `src/utils/normalizeFlightSelection.ts::buildFlightSelectionFromLegs` — call `autoTagLegs` on input legs as last-mile safety net.

### 3. Hide the irrelevant button per leg

Match the pattern `MultiLegFlightEditor` already uses (lines 884 / 900). Apply to:

- `src/components/itinerary/AddBookingInline.tsx` (lines 555–593) — for round-trips, hide "Mark as destination arrival" on the return leg (leg 1 of 2) and hide "Mark as departure from destination" on the outbound (leg 0 of 2). For one-way single leg, hide "departure from destination". For 3+ legs leave both visible (real ambiguity).
- `src/components/itinerary/SortableFlightLegCards.tsx` (lines 240–260) — same rule, using leg index + total leg count.

The button row should also show "Auto-detected" subtle label when the flag was stamped by `autoTagLegs` rather than the user (use a new optional `autoTagged?: boolean` field on the leg, set transiently in component state — does not need to persist).

### 4. One-shot heal on read

`normalizeFlightSelection` already runs on read at every consumer. Add an `autoTag: true` option (default true) that runs `autoTagLegs` on the returned legs so existing persisted trips with no flags benefit immediately on next render — no migration needed.

## Files touched

- `src/utils/normalizeFlightSelection.ts` — add `autoTagLegs` + wire into `normalize` + `buildFlightSelectionFromLegs`.
- `src/components/planner/flight/MultiLegFlightEditor.tsx` — call `autoTagLegs` before emit.
- `src/components/itinerary/AddBookingInline.tsx` — call `autoTagLegs` on save + conditional button visibility.
- `src/components/itinerary/SortableFlightLegCards.tsx` — conditional button visibility.
- `src/utils/__tests__/autoTagLegs.test.ts` (new) — covers: 1 leg, 2 legs (round-trip), 3 legs with layover (CDG matches), 4 legs multi-city, user-set flag preserved.

## Acceptance criteria

- ATL → CDG / CDG → ATL round-trip: outbound shows "Destination arrival ✓" automatically; return shows "Departure from destination ✓" automatically. No manual click required.
- Outbound leg only shows the arrival button; return leg only shows the departure button.
- User can still click to clear/move the flag (toggle behavior preserved).
- Multi-city ATL → CDG → FCO → ATL with FCO as final destination: arrival auto-marks on the FCO-arriving leg, departure auto-marks on the FCO-departing leg.
- Existing trips with neither flag set render correctly on next load without a save.
- `getFirstLegArrivalTime` / `pickDestinationArrivalLeg` hit the `isDestinationArrival_flag` source instead of the heuristic fallback.

## Out of scope

- Server-side backfill of persisted `flight_selection` rows (handled lazily on next save via the read-time autotag).
- Changing how the AI itinerary reads flight timing (Issue 1 already shipped — this just feeds it cleaner data).
- Smart layover detection beyond airport-code match against trip destination IATA.
