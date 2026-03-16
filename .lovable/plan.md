
Root cause summary:

- This is not primarily a CORS config bug. The function already has CORS headers.
- The real failure is upstream 502/host errors during internal self-calls. I found logs showing `generate-trip-day` failing with `Day 2 HTTP 502` and returning a Cloudflare/Supabase host error page. When that happens, the browser reports it as a CORS error because the platform-level 502 response does not include your function’s CORS headers.
- It keeps recurring because the itinerary pipeline is still structurally fragile:
  1. `generate-trip` starts a server chain
  2. `generate-trip-day` calls `generate-day` over HTTP
  3. then `generate-trip-day` calls the next `generate-trip-day` over HTTP
  That means multiple network hops inside the same backend flow.
- I also found evidence of a second structural problem: recent trips marked `ready` even when `trips.itinerary_data.days` is incomplete compared with `itinerary_days`. So completion state can drift from actual saved JSON.
- There is also a confirmed bug in `attraction-matching.ts` (`supabase.sql is not a function`) firing during generation. It’s not the main cause, but it adds noise/time on every run.

Plan to fix it for good:

1. Remove the fragile inner HTTP hop
- Extract the actual day-generation logic into a shared module.
- Make both:
  - `action: generate-day`
  - `action-generate-trip-day.ts`
  use that shared function directly.
- This removes the most failure-prone part: `generate-trip-day -> fetch(generate-itinerary action=generate-day)`.

2. Make backend completion strict and canonical
- Only allow `itinerary_status = 'ready'` when:
  - `trips.itinerary_data.days.length === expectedTotalDays`
  - every day has at least 1 real activity
- Do not let `itinerary_days` row count or stale metadata mark a trip ready.
- If JSON and normalized tables disagree, reconcile before finalizing.

3. Make recovery deterministic
- Persist exact failure state in metadata:
  - `failed_day_number`
  - `last_successful_day`
  - `generation_run_id`
- Resume from the first missing/failed day only.
- In frontend recovery, detect “ready but incomplete JSON” and trigger a backend resume once, instead of trusting table counts.

4. Keep only one async handoff per day
- After saving day N, only the “next day” handoff remains.
- Add timeout + retry classification around that call.
- Treat 502/504 host errors as retryable infrastructure failures.
- Never let a chain failure flip the trip to `ready`.

5. Fix the known runtime bug
- Replace the unsupported `supabase.sql` increment in `supabase/functions/generate-itinerary/attraction-matching.ts` with a supported update pattern.
- This removes a recurring exception during generation.

6. Add regression tests for this exact class of failure
- Test: day 2 upstream 502 never results in `ready`
- Test: 5-day trip cannot finalize with only 2 JSON days
- Test: resume starts from failed/missing day
- Test: frontend shows recovery state for “ready + incomplete JSON”, not completed itinerary

Files involved:
- `supabase/functions/generate-itinerary/index.ts`
- `supabase/functions/generate-itinerary/action-generate-trip.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/attraction-matching.ts`
- new shared day-generation module under `supabase/functions/generate-itinerary/`
- `src/pages/TripDetail.tsx`
- `src/components/itinerary/ItineraryGenerator.tsx`

Expected result:
- The recurring “CORS” error stops being the visible symptom because the failing nested self-call is removed.
- Multi-city generation becomes much more stable because each day is generated in-process, not through another HTTP round-trip.
- A trip cannot be marked ready unless the canonical itinerary JSON is truly complete.
- Recovery becomes predictable instead of heuristic.
