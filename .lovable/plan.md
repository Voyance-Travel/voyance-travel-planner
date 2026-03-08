
Goal: stop 4-day generations from prematurely ending with only 1 day shown.

What I found
- The prior `TripDetail.tsx onFailed` fix is already present.
- The current main failure path is now in `ItineraryGenerator.tsx`:
  - `recoverFromDatabase()` treats **any** `itinerary_data.days.length > 0` as “ready”.
  - It then calls `onComplete(existingDays)`.
  - `TripDetail.handleGenerationComplete()` writes `itinerary_status='ready'` with those partial days.
  - Backend chain then stops early because `generate-trip-day` exits when trip status is `ready`.
- This exactly matches your symptom: generation meant for multiple days, but app finalizes and displays day 1 only.

Implementation plan

1) Fix false “ready” in `src/components/itinerary/ItineraryGenerator.tsx`
- Update `recoverFromDatabase()` readiness criteria:
  - Read `expectedTotalDays` from `trip.metadata.generation_total_days` (fallback to inclusive date count).
  - Compare against actual generated count using both:
    - `itinerary_data.days.length`
    - `itinerary_days` table count
  - Only return `ready` + call `onComplete` when all expected days are present.
- If partial data exists, return `in_progress` (not `ready`), keep poller active, and preserve reconnect/retry behavior.

2) Prevent accidental finalization during recovery flows
- Ensure all recovery triggers (poller failure, visibility/focus checks, retry timer) never finalize from partial data.
- Keep state in polling/stalled mode instead of calling `onComplete` for partials.

3) Add defensive guard in `src/pages/TripDetail.tsx` `handleGenerationComplete`
- Before writing `itinerary_status='ready'`, verify `generatedDays.length >= expectedTotalDays`.
- If partial:
  - do not persist ready status,
  - set stalled/recovery UI state,
  - trigger resume path instead of saving incomplete itinerary as final.
- This is defense-in-depth in case another path passes partial days later.

4) Add “incomplete-ready” self-heal in TripDetail render/bootstrap path
- Detect corrupted state on load:
  - `itinerary_status='ready'` but generated day count < expected total.
- Route to stalled/reconnecting UI + resume action rather than rendering itinerary as complete.
- This repairs already-affected trips and prevents “Day 1 of 1” misreporting.

Technical details (concise)
- New shared helper logic (frontend-side): compute expected vs actual day counts.
- Expected count precedence:
  1) `metadata.generation_total_days` if > 0
  2) inclusive date count fallback (`end - start + 1`)
- Actual count precedence:
  - max of `itinerary_data.days.length` and `itinerary_days` count for recovery decisions.
- Completion requires `actual >= expected` when expected is known.

Validation plan
1) Start a 3-night / 4-day generation.
2) Simulate interruption after day 1 (network drop / tab background).
3) Verify:
- no premature “Your itinerary is ready! 🎉”
- UI shows reconnecting/stalled with correct denominator (e.g., Day 1 of 4)
- resume continues from next day
- final ready toast only appears when all expected days exist
4) Re-open an already-corrupted partial-ready trip and verify it auto-detects incomplete state and offers resume instead of showing a fake complete itinerary.

Scope
- Files to update:
  - `src/components/itinerary/ItineraryGenerator.tsx`
  - `src/pages/TripDetail.tsx`
- No backend schema changes required.
