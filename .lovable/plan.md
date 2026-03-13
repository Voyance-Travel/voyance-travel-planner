
Goal: Fix two linked issues in journey (multi-leg) generation:
1) next leg gets stuck after leg 1 completes, and
2) confirmation pricing does not reliably reflect full journey cost.

What I found
- Runtime evidence shows stuck leg rows in `trips` with:
  - `itinerary_status='generating'`
  - no `generation_heartbeat`, no `generation_started_at`, and no days saved.
- Root cause A (backend handoff):
  - `triggerNextJourneyLeg()` calls `generate-itinerary` with only `{ tripId }`.
  - The function requires an `action` route (e.g. `generate-trip`) plus trip fields.
  - Service-role bypass currently allows only `generate-trip-day/generate-day/regenerate-day`, so this handoff can be rejected and leaves leg 2 in `generating`.
- Root cause B (frontend fallback):
  - `TripDetail` queued-leg fallback also invokes with `{ tripId }` and pre-sets status to `generating`, which can also deadlock.
- Root cause C (pricing mismatch):
  - Cost confirm dialog is shown before journey leg breakdown is prepared.
  - `useGenerationGate` computes journey total as sum of per-leg single-city estimates, which omits the journey-level multi-city fee.

Implementation plan
1) Fix backend journey handoff (`supabase/functions/generate-itinerary/index.ts`)
- Update `triggerNextJourneyLeg()` to fetch the next leg’s required fields:
  `destination, destination_country, start_date, end_date, travelers, trip_type, budget_tier, is_multi_city, user_id`.
- Invoke function with explicit payload:
  `action: 'generate-trip'` + full trip params + `tripId` + `userId`.
- Expand service-role bypass allowlist to include `generate-trip` for internal server-to-server chaining.
- Treat non-2xx as failure (not just thrown fetch errors):
  - log response body/status,
  - reset leg back to `queued`,
  - write chain error metadata for diagnostics.

2) Fix frontend queued fallback (`src/pages/TripDetail.tsx`)
- Replace `{ tripId }` invoke with full `generate-trip` payload (same fields as above from current trip row).
- Do not set `itinerary_status='generating'` before successful invoke; let backend set canonical state.
- Keep queued state if invoke fails so retry logic can reattempt safely.

3) Recover already-stuck legs automatically (scope you selected)
- Add stuck-leg self-heal on Trip detail load for journey legs:
  - condition: `itinerary_status='generating'`, no heartbeat/start marker, no generated days, and stale `updated_at`.
  - action: safely re-trigger `generate-trip` with full payload.
- Keep idempotent guard to avoid repeated kicks.

4) Make confirmation cost reflect full journey before user confirms (`src/components/itinerary/ItineraryGenerator.tsx`)
- Precompute journey pricing context before showing cost modal (not after confirm).
- Build and store:
  - leg-by-leg display rows,
  - effective journey total,
  - journey mode flag (to disable partial generation correctly).
- Ensure modal always uses this precomputed journey total when leg 1 is part of a journey.

5) Align charging logic with displayed journey pricing (`src/hooks/useGenerationGate.ts`)
- Replace per-leg single-city sum with one canonical journey estimate:
  - total journey days (sum of leg day spans),
  - cities array of all leg destinations,
  - `calculateTripCredits({ days: totalJourneyDays, cities: allCities })`.
- This adds the missing journey multi-city fee and keeps display + deduction consistent.

Technical details
- Files to update:
  - `supabase/functions/generate-itinerary/index.ts`
  - `src/pages/TripDetail.tsx`
  - `src/components/itinerary/ItineraryGenerator.tsx`
  - `src/hooks/useGenerationGate.ts`
- Safety/behavior guarantees:
  - only leg 1 charges; downstream legs remain queued/auto-triggered.
  - no duplicate charges from retries (existing credit idempotency remains authoritative).
  - failed handoff never leaves next leg permanently “fake-generating”.

Validation checklist after implementation
- Start a 3-leg journey from leg 1.
- Confirm modal shows full journey total before pressing confirm.
- After leg 1 reaches ready, leg 2 transitions queued → generating with heartbeat/day progress.
- Leg 3 starts automatically after leg 2 completes.
- Credit ledger shows one journey-generation deduction matching confirmation total.
- Open an older stuck leg page and verify auto-recovery starts generation.
