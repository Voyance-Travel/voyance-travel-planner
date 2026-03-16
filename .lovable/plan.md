
What is actually wrong

I inspected the live backend state for the trip in your screenshot, and the core problem is not “the AI failed to generate.” The trip has already generated correctly in one place, but the app is reading conflicting data from another place.

What I found
- The trip row already has real itinerary content:
  - `trips.itinerary_status = 'ready'`
  - `trips.unlocked_day_count = 4`
  - `trips.itinerary_data.days` exists, and Day 1 already has activities
- But the secondary itinerary tables are stale/broken:
  - `itinerary_days` has 4 rows, but every row has `activities: []`
  - `itinerary_activities` has 0 rows
- The generator logs say the chain finished successfully, which matches the good JSON on the trip row.

So the regression is a split-brain state:
1. Canonical trip JSON says “generated + unlocked”
2. Secondary day tables say “shell days / empty”
3. Some UI paths still trust the shell tables or transient entitlement state
4. That creates the flash, bounce-back, and “unlock days you already paid for” behavior

The most important code issue still present
- `src/hooks/useGenerationPoller.ts` still marks generation as ready when `itinerary_days` count reaches total days, even if those rows have zero activities.
- `supabase/functions/generate-itinerary/action-sync-tables.ts` is not fully restoring the normalized tables to match the good JSON payload, so shell rows survive after generation.
- The per-day lock UI relies too heavily on entitlements loading cleanly, instead of also trusting the already-loaded trip row (`unlocked_day_count` / paid trip state).

Implementation plan

1. Make one source of truth for completion
- Treat `trips.itinerary_data.days` with real activities as the canonical “ready” signal.
- In `src/hooks/useGenerationPoller.ts`, remove the fallback that marks ready based only on `itinerary_days` row count.
- Only finalize when:
  - expected day count is met, and
  - the returned days contain real activities

2. Fix the backend sync path so secondary tables stop lying
- Update `supabase/functions/generate-itinerary/action-sync-tables.ts` so it fully syncs normalized tables from `trips.itinerary_data.days`
- On sync:
  - upsert `itinerary_days`
  - replace stale per-day activities in `itinerary_activities`
  - optionally also mirror `activities` onto `itinerary_days.activities` if the frontend still reads that column
- Add a hard guard: if JSON has activities but sync writes 0 normalized activities, log it loudly and do not silently treat that as healthy

3. Stop showing “locked” for already-unlocked trips during transient loading
- In `src/pages/TripDetail.tsx` and `src/components/itinerary/EditorialItinerary.tsx`, add an effective access fallback:
  - if the loaded trip row says `unlocked_day_count >= dayNumber` or Smart Finish was purchased, do not render locked states while entitlements are still loading/recovering
- This prevents the bogus “Unlock All Remaining” banner for trips that are already paid/unlocked

4. Tighten recovery logic so refresh is never required
- Keep the current shell-day guard, but also ensure recovery never prefers `itinerary_days.activities: []` over populated `trips.itinerary_data.days`
- Remove any remaining paths that interpret “days exist” as “usable itinerary exists”

5. Add regression coverage for this exact failure mode
- Backend test: generation completes with good `trips.itinerary_data`, but normalized tables are stale/empty
- Frontend test: poller must not declare ready from shell day rows alone
- UI test: unlocked trip must not show locked banner while entitlements are catching up

Files to change
- `src/hooks/useGenerationPoller.ts`
- `src/pages/TripDetail.tsx`
- `src/components/itinerary/EditorialItinerary.tsx`
- `supabase/functions/generate-itinerary/action-sync-tables.ts`
- likely `supabase/functions/generate-itinerary/action-generate-trip-day.ts` for stronger sync/error logging
- related regression tests

Expected result
- No more “generated but empty” bounce
- No more needing a manual refresh to see the itinerary
- No more “unlock these days” prompt on trips that are already unlocked
- One canonical completion path instead of competing signals from trip JSON vs shell tables
