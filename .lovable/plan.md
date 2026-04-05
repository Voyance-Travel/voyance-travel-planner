
What this warning means

- This is not the generator “trying and failing” over and over. It is the frontend repeatedly surfacing the same backend failure state.
- The exact error text comes from `supabase/functions/generate-itinerary/action-generate-trip-day.ts` at the structural guard around lines `1097-1121`.
- After Day 2 finishes, the backend checks:
  `newDayActivities.length === 0`
  If true, it writes:
  - `metadata.generation_error = "Day 2 generated with 0 activities"`
  - `metadata.generation_failed_on_day = 2`
  - `metadata.empty_day_detected = true`
  - and marks the trip `failed` or `partial` depending on prior saved days.

Why your console shows this exact warning

- `src/hooks/useGenerationPoller.ts` polls the trip row.
- When it sees `itinerary_status === 'failed'`, it reads `meta.generation_error` and calls `onFailed(...)` at lines `242-245`.
- `src/components/itinerary/ItineraryGenerator.tsx` receives that callback and intentionally does not show a hard user-facing error. Instead it logs:
  `[ItineraryGenerator] Suppressing generation error (poller.onFailed) ...`
  via `suppressErrorAndRecover()` at lines `457-478`.

Why it repeats so many times

- The poller has no “fire this failure only once” guard.
- After suppressing the error, `ItineraryGenerator` runs `recoverFromDatabase()`.
- If the trip looks incomplete rather than ready, it keeps `serverGenActive` on and continues polling.
- On the next poll, the trip is still in the same failed state with the same `generation_error`, so `onFailed(...)` fires again.
- Result: the same warning is logged repeatedly even though it is one persistent failure, not many distinct failures.

Important nuance

- `useGenerationPoller` only calls `onFailed` for status `failed`, not `partial`.
- So if you are seeing `poller.onFailed`, the trip row was in `failed` state when the poller read it.
- That means either:
  1. Day 2 truly ended as a hard failure, or
  2. another failure path later/elsewhere set the trip back to `failed`.

What the warning is really telling you

- Day 2 ended up with zero activities after the backend pipeline finished.
- That empty-day guard is working correctly.
- The noisy/problematic part is the frontend recovery loop repeatedly re-logging the same failure.

Most relevant files

- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `src/hooks/useGenerationPoller.ts`
- `src/components/itinerary/ItineraryGenerator.tsx`

Best next fix path

1. Add a dedupe guard in `useGenerationPoller` so the same `generation_error` only triggers `onFailed` once per run.
2. Treat “empty generated day” as a resumable/stalled condition when earlier days already exist, instead of leaving the UI in a repeated failed-poll cycle.
3. Add targeted logging in the Day 2 backend pipeline to determine why activities became zero:
   - AI returned no valid activities
   - sanitization stripped them
   - validation/repair removed them
