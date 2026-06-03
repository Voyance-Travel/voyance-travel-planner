# Day 4 Missing Airport Transit — Fix Plan

## Root cause (refined)

Two real defects, not one:

1. **Prompt contradiction (early-flight branch).** `pipeline/compile-day-schema.ts` line 593 declares `DEPARTURE DAY ACTIVITIES: 1 maximum (near hotel only)` and then immediately lists a 5-step REQUIRED SEQUENCE that includes the transfer + departure cards. The AI complies with the cap and stops at breakfast + checkout.

2. **Deterministic backstop is partial, not absent.** `enforceDepartureDayLogistics` in `pipeline/repair-day.ts` (§15z, line 4588) *does* inject a missing airport transfer (line 4679–4700) and is wired into both the chain final step (`action-generate-trip-day.ts` line 3972) and `action-save-itinerary.ts` (STEP 2.65, line 1055). BUT injection is gated on `hasFlight = depMins !== null`, which means whenever `returnDepartureTime24` fails to propagate (chat-planner flights, multi-leg trips where the JSON fallback at L4027 misses) the transfer is silently skipped. There is also no explicit "Departure" card (step 5) ever injected — only checkout + transfer.

The user's claim "zero deterministic injection" is incorrect; the real problem is that the existing injector under-fires and never emits the boarding/departure card.

## Changes

### 1. Resolve the prompt contradiction
File: `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts`

In the early-flight branch (around line 593), rewrite the cap to be consistent with the required sequence:

- Replace `DEPARTURE DAY ACTIVITIES: 1 maximum (near hotel only)` with something like `DEPARTURE DAY ACTIVITIES: breakfast + checkout + transfer + departure are REQUIRED; AT MOST 1 optional light activity near the hotel (step 3 below).`
- Audit the three other branches (afternoon-flight line 627+, evening-flight line 649+, condensed line 711+) for the same "N maximum" vs "K required" wording mismatch and harmonize.

This is the cheap, high-leverage half — it stops the AI from dropping items 3–5 on compliant turns.

### 2. Harden `enforceDepartureDayLogistics` injection
File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (§15z, around line 4588–4700)

- Inject a "Departure" card (step 5 in the prompt) when none exists and `hasFlight` is true: `startTime = airportArrival (depMins − buffer)`, `endTime = departure24`, `category: transport`, `subcategory: 'departure'`, `source: 'repair-final-departure-enforce'`. Idempotent like checkout/transfer.
- When `returnDepartureTime24` is falsy, recompute `depMins` from any existing flight card on the day (`category === 'flight'` with a `startTime`) before falling through to the no-flight branch. The chain caller already attempts a JSON fallback (action-generate-trip-day.ts L4027); push the same fallback inside §15z so every call site is covered, including `action-save-itinerary.ts` STEP 2.65 and `action-sync-tables.ts` L99.
- Log a structured `[Repair §15z] missing_flight_clock_recovered_from=<json|flight-card|none>` so we can attribute future misses.

### 3. Cover the chain path for the new "Departure" card
File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (around line 3990)

No code change beyond the §15z update — chain already invokes `enforceDepartureDayLogistics` so the new injection branch picks up automatically.

### 4. Tests
- Extend `supabase/functions/_shared/__tests__/departure-day-combined.test.ts` and/or `__tests__/save-itinerary-departure-day.test.ts`:
  - Early-flight (11:00) departure day with **only** breakfast + checkout in input → output must contain both `airport_transfer` and `departure` cards in the correct order.
  - Same scenario with `returnDepartureTime24` undefined but a `category: 'flight'` card present → injection still fires using the flight card's `startTime`.
  - Locked transfer is respected (no duplicate departure card injected if user already locked one).
  - No-flight scenario unchanged: no transfer, no departure, soft prompt card preserved.

### 5. Memory
Update `mem://constraints/itinerary/airport-transit-must-be-taxi.md` (and the index entry) to extend the constraint: §15z now guarantees both the transfer **and** a "Departure" card, with flight-clock recovery from JSON or an existing flight card.

## Out of scope

- Frontend changes (`TripDetail`/`TripHealthPanel`): the health panel will naturally flip to green once the cards are persisted. No UI edits needed.
- Backfill of existing already-persisted trips. If desired later, a lazy `backfill-departure-day-logistics` edge fn can mirror `backfill-must-do-anchor-enrichment`; out of scope for this fix.

## Files touched

- `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts` (prompt copy)
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (§15z hardening)
- `supabase/functions/_shared/__tests__/departure-day-combined.test.ts` (new cases)
- `mem/constraints/itinerary/airport-transit-must-be-taxi.md` + `mem/index.md` (constraint update)
