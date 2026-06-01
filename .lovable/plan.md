
## Problem

Barcelona QA: actual itinerary correctly says "Landing at 22:30", but FlightSyncWarning fires "Day 1 shows arrival at 8:30 PM" and the stored anchor is 2h off.

Root cause is in `supabase/functions/generate-itinerary/flight-hotel-context.ts` (lines 334–338). `intelArrRaw` comes from `flight_intelligence.destinationSchedule[0].arrivalDatetime`, which is stored as a UTC ISO string (e.g. `2026-06-15T20:30:00Z`). The current code naively splits on `T` and takes `substring(0,5)` → `"20:30"` UTC. The user-entered arrival (`22:30` BCN local, UTC+2) is local destination time. The cross-source check compares `20:30` vs `22:30`, sees >30m drift, logs `[FLIGHT_TRUTH_DISAGREE]`, and flips `arrivalTruthSource='flight_intelligence'` — which downstream consumers (the FE FlightSyncWarning detector + stored anchor) then trust as truth, corrupting Day 1.

We cannot safely convert UTC → local destination without the IANA timezone (which we don't have at this call site). The correct behavior is to exclude UTC-marked ISO values from the candidates list so picker (which already returned local destination time) wins unambiguously.

## Change

Single-file, single-block edit in `supabase/functions/generate-itinerary/flight-hotel-context.ts` around lines 336–338. Replace the one-liner `intelArr` computation with an IIFE that:

1. Returns `undefined` when `intelArrRaw` ends in `Z` or carries an explicit `±HH:MM` offset after the `T` segment (UTC / offset-anchored — cannot be safely localized here).
2. Otherwise, when the time segment is timezone-naive (`HH:mm[:ss]` with no `Z`/offset), normalizes it via `normalizeTo24h` as before (treated as already-local).
3. When the value has no `T` at all (already a bare time string), normalizes it as before.

Result: `flight_intelligence` drops out of the `candidates` array whenever it's a UTC ISO, so the picker's local time is the only entry and `disagree` stays false. The downstream `if (intelArr) arrivalTruthSource = 'flight_intelligence'` override branch can no longer fire on a UTC value, so the stored anchor + FE warning both read the correct local time.

No other call sites change. The `flight_intelligence` precedence block further down still runs on its own raw fields — this fix only affects the cross-source sanity comparator.

## Verification

- Unit test in `supabase/functions/_shared/__tests__/` covering:
  - UTC ISO intel (`...T20:30:00Z`) + picker `22:30` → no disagree, `arrivalTruthSource='picker'`.
  - Offset ISO (`...T20:30:00+00:00`) → same: excluded.
  - Naive ISO (`...T22:30:00`) + picker `22:30` → included, no disagree.
  - Bare `"22:30"` → included as today.
- Re-run Barcelona fixture; confirm no `[FLIGHT_TRUTH_DISAGREE]` log and FlightSyncWarning suppressed.

## Out of scope (flag separately)

- **Day 4 empty (departure day)**: distinct from this bug; needs its own investigation in the chain finalizer / departure-day logistics path before I touch it. I'll surface as a follow-up after this lands rather than bundling.

Confirm and I'll implement.
