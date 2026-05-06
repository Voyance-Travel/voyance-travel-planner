## Problem

The user's trip `b552bb7c…` is `itinerary_status='failed'` with **0 days saved** and `metadata.generation_error = "Day 2 generated with 0 activities"`. The UI sits on the generation/loading screen forever ("stuck on the final day") because:

1. **Backend bails the whole chain on a single empty day.**
   `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (lines 1892–1918) detects `newDayActivities.length === 0` and immediately writes `itinerary_status='failed'` and `return`s — *without* retrying the day and *without* continuing to subsequent days. That's inconsistent with the HTTP-error path (lines 673–744), which retries up to `MAX_RETRIES` and then keeps chaining when not on the last day.

2. **Client auto-resume only triggers on partial data.**
   `src/pages/TripDetail.tsx` self-heal (lines 1224–1235) only fires when `0 < actualDays < expectedTotal`. With 0 saved days + status `failed`, neither resume nor a clear retry CTA renders, so the user keeps staring at `GenerationPhases` / the stalled spinner.

3. **No user-facing recovery for "empty failure".** The "Retry manually" button only shows in the `showStalledUI` branch, which requires the poller to be active. After a hard-fail it isn't.

## Fix

### 1. Backend – don't kill the trip on one empty day
File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

Replace the empty-day short-circuit with the same recovery shape used for HTTP failures:

- Push `dayNumber` into `metadata.failed_day_numbers`.
- If this is *not* the last day, write a heartbeat and **continue the chain** (recurse / chain to `dayNumber + 1`) rather than returning a terminal `failed` response.
- If it *is* the last day:
  - If at least one earlier day has activities → mark `itinerary_status='partial'` and refund per-day credits for failed days (mirror the existing partial-refund block at lines 745–790).
  - Only when *all* days are empty → keep the current `failed` + full-refund behavior.
- Before bailing on a single empty day, do **one in-place retry** of `generate-day` for that day (mini-loop, max 2 attempts) so transient AI returns don't poison the chain.

### 2. Client – surface an explicit retry when generation hard-failed with no data
File: `src/pages/TripDetail.tsx`

- Extend the existing self-heal block (around lines 1224–1235) so that when `itinerary_status === 'failed'` and `actualDays === 0` and `expectedTotal > 0`, we:
  - Call `handleResumeGeneration()` once automatically (guarded by `autoResumeAttemptedRef`).
  - If the auto-attempt has already been used, set `setGenerationStalled(true)` so the existing "Retry manually" UI renders instead of the perpetual loader.
- In `handleResumeGeneration` (lines 383–454), when the trip is recovering from `failed`/empty state, set `resumeFromDay: 1` (not `completedDays + 1 = 1` by accident — make it explicit) and clear `metadata.empty_day_detected`, `generation_failed_on_day`, `failed_day_numbers` before re-invoking.

### 3. Client – widen the stalled gate
File: `src/pages/TripDetail.tsx` (around line 2371)

`isServerGenerating || generationStalled` already shows the retry UI, but the "Retry manually" button is nested inside `showStalledUI`. Ensure `showStalledUI` becomes true whenever `trip.itinerary_status === 'failed'` and there are 0 saved days, so the user always has a visible "Retry" instead of just the spinner.

## Out of scope

- The `<circle> attribute r: undefined` warning is a separate Recharts/Sparkline issue surfaced by missing trip stats; not addressed here.
- The `lookup-restaurant-url` 4xx and the message-channel browser-extension noise are unrelated.

## Technical notes

- Empty-day retry should reuse the same `generateUrl` POST already used at line 587, with the same body. Cap retries at 2 to avoid blowing the 180s window.
- When marking `partial`, snapshot `unlocked_day_count` to `existingDays.length` so the user can open what *did* generate.
- Keep refund accounting consistent with the existing `creditsPerDay = round(totalCharged / effectiveTotalDays)` math at lines 763–765.
- After backend changes, verify with: `psql -c "select itinerary_status, jsonb_array_length(itinerary_data->'days'), metadata->'failed_day_numbers' from trips where id='b552bb7c-7475-4d5a-a4bf-2ccecfe7cfe3'"` post-resume.

## Files touched

- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `src/pages/TripDetail.tsx`
