## Flight Arrival Truth Stamping in action-generate-day.ts

### Problem
`action-generate-day.ts` (single-day standalone generator) parses the LLM response, normalizes activities, runs filters and enrichment, then feeds the day into `validateDay` + `repairDay`. The integrity contract (`itinerary-integrity-contract.ts`) correctly detects when the LLM-emitted arrival card time disagrees with the user's flight truth and blocks the trip (`FLIGHT_ANCHOR_COMMIT_MISMATCH` → `status = 'partial'`). However, no code in `action-generate-day.ts` ever overwrites the LLM's arrival time with the user's ground truth — detection works, but the source is never fixed.

`action-generate-trip-day.ts` (server-chain path) already calls `stampArrivalAnchorTruth` after the LLM response; `action-generate-day.ts` does not.

### Fix
Add one post-processing pass in `action-generate-day.ts` that stamps the arrival-flight card with the user's actual arrival time before validation runs.

### Files to change
1. **`supabase/functions/generate-itinerary/action-generate-day.ts`**
   - Import `stampArrivalAnchorTruth` from `../_shared/stamp-arrival-anchor-truth.ts`
   - After all day construction is complete (after `normalizedActivities = generatedDay.activities` at line ~997 and before the "PIPELINE PHASE 3" block at line ~1147), call:
     ```ts
     stampArrivalAnchorTruth(generatedDay, {
       isFirstDay,
       arrivalTime24: (flightContext as any)?.arrivalTime24,
       arrivalAirport: arrivalAirportDisplay || (flightContext as any)?.arrivalAirport,
       airportProcessingMins: 45,
       isHotelChange: facts.resolvedIsHotelChange,
     });
     ```
   - Log the result so telemetry captures `[STAMP_ARRIVAL_TRUTH] action-generate-day day=N was=… now=…`

2. **`mem/index.md`**
   - Append a cross-reference entry linking to the existing `mem://constraints/itinerary/flight-anchor-truth-parity.md` memory, noting that `action-generate-day.ts` now also stamps arrival truth (parity with `action-generate-trip-day.ts`).

### Why this location
- After line ~997: all must-do backfill, transition-day fallback injection, and title cleanup are done — the activity list is in its final shape.
- Before line ~1147: the pipeline validate/repair phase needs the arrival card to already match truth so `validateDay` and the integrity contract downstream see the correct value.

### No other changes needed
- `stampArrivalAnchorTruth` is already tested (`stamp-arrival-anchor-truth.test.ts` — 6 cases covering overwrite, idempotency, hotel-change no-op, etc.)
- The integrity contract already verifies the stamped value and will continue to block if any future leak reappears.
- No DB schema changes, no new dependencies, no frontend changes.

### Deployment
- Redeploy `generate-itinerary` edge function after the edit.