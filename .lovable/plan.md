
Problem confirmed: this is a regression, but it is not a timeout/queue problem. The backend already uses a chained background generation flow. The real failure is that the trip is being marked “ready” with shell days that have titles/themes but zero activities, and the frontend then misclassifies that shell as complete for a moment before falling back to the empty “Ready to plan your adventure” state.

What I found:
- The Tokyo trip in the backend is currently `itinerary_status = 'ready'`.
- It has 8 `itinerary_data.days`, but every day’s `activities` array is empty.
- `metadata.generation_completed_days` is stale at `6`, even though 8 day shells exist.
- `itinerary_days` has 8 rows, but `itinerary_activities` has 0 rows.
- That exactly explains the UX:
  1. generator opens
  2. cost/payment UI flashes briefly
  3. recovery logic sees “8 days exist” and treats it as complete
  4. parent view recalculates `hasItinerary = false` because there are no activities
  5. user gets bounced back to “Ready to plan your adventure”

Root causes:
1. Backend `generate-day` is allowed to return an invalid day on the last retry.
   - In `supabase/functions/generate-itinerary/index.ts`, the current logic returns the day on the last attempt even if validation errors remain.
   - That means structurally broken days like `activities: []` can still be accepted and saved.

2. Chain completion is too trusting.
   - In `supabase/functions/generate-itinerary/action-generate-trip-day.ts`, the trip is marked `ready` once all day shells exist, even if some/all days have zero activities.

3. Frontend recovery is too trusting.
   - In `src/components/itinerary/ItineraryGenerator.tsx`, `recoverFromDatabase()` treats “days exist” as “generation complete,” without checking for real activities.
   - That causes the brief modal/confirmation flash before it exits.

4. Total-day reconciliation is using stale metadata in some places.
   - `generation_total_days` / `generation_completed_days` can lag behind the real date span and should not be the primary readiness signal.

Implementation plan

1. Tighten backend validation so empty days can never be accepted
- Update `supabase/functions/generate-itinerary/index.ts`.
- Split validation failures into:
  - hard structural failures: no activities, too few real activities after post-processing, missing required transport on transition days
  - soft quality failures: weaker preference misses, lighter polish issues
- On the final retry, only allow soft failures through.
- If a day still has zero activities, return an error instead of returning the shell day.

2. Block “ready” status when any saved day is still a shell
- Update `supabase/functions/generate-itinerary/action-generate-trip-day.ts`.
- Before setting `itinerary_status = 'ready'`, verify the final `updatedDays` array has real content.
- If one or more days are empty:
  - do not mark the trip ready
  - mark it `partial` or leave it resumable
  - set metadata like `chain_broken_at_day` / `generation_error`
- This prevents the chain from finalizing broken output.

3. Make frontend recovery treat shell itineraries as incomplete
- Update `src/components/itinerary/ItineraryGenerator.tsx`.
- In `recoverFromDatabase()`, require at least one real activity per expected generated day before calling `onComplete`.
- If days exist but are empty shells, keep the generator in recovery/polling mode instead of exiting.
- This removes the “payment screen flash then bounce back” behavior.

4. Make TripDetail fail closed on shell itineraries
- Update `src/pages/TripDetail.tsx`.
- Reuse a stricter “has real itinerary content” check for:
  - auto-generate routing
  - `handleGenerationComplete`
  - empty-state fallback
- If the trip has day shells but no real activities, show stalled/recovery behavior instead of the generic empty CTA.

5. Fix readiness math to prefer canonical date span over stale metadata
- Update both:
  - `src/components/itinerary/ItineraryGenerator.tsx`
  - `src/pages/TripDetail.tsx`
- Compute expected total days from `start_date`/`end_date` first, then use metadata only as fallback.
- Self-heal stale `generation_total_days` when it disagrees with the actual trip span.

6. Add a regression test for this exact bug
- Add/extend edge-function tests around the chained generation path.
- Cover:
  - last retry returning a day with `activities: []`
  - trip must not become `ready`
  - frontend recovery should not treat shell days as complete
- This is the key regression guard for the Tokyo case.

Files to change
- `supabase/functions/generate-itinerary/index.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `src/components/itinerary/ItineraryGenerator.tsx`
- `src/pages/TripDetail.tsx`

Expected outcome
- A broken/empty generated day will no longer be silently accepted.
- Trips with shell-only days will no longer be marked complete.
- The generator will stay in recovery/resume mode instead of flashing the payment confirmation and dumping the user back to “Ready to plan your adventure.”
- Existing affected trips can be resumed/regenerated safely instead of appearing “ready but empty.”
