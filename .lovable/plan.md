
Goal: replace the partial fixes with end-to-end enforcement at the final save path, because the current code only solved parts of the problem.

What the audit shows now
- Bug 1 is only partially fixed:
  - Client `mealGuard.ts` already skips zero-activity days.
  - Chain retries in `index.ts` are already 5 attempts.
  - But the backend still injects fallback meals in `day-validation.ts` via `enforceRequiredMealsFinalGuard()`, and both `generate-day` and chain-save paths still call it. That can still turn failed/empty days into fake meal-only days.
  - The trip page already has stalled/resume behavior, but it does not give a persistent “this itinerary is incomplete” state once shell days are saved.
- Bug 2 is only partially fixed:
  - New regexes exist in `sanitization.ts`, but they are still too narrow and only run early in the pipeline.
  - Later post-processing can still reintroduce user-visible leak text, especially meal fallback copy.
- Bug 3 is not actually fixed:
  - `enforceHotelPlaceholderOnDay()` only renames hallucinated hotel brands to “Your Hotel”.
  - The prompt still contains unconditional hotel/check-in/return-to-hotel instructions even when no hotel exists.
- Bug 4 is under-fixed:
  - `deduplicateCrossDayVenues()` currently uses exact title/location matching only.
  - The codebase already has stronger concept-similarity dedup helpers elsewhere, but the new path does not use them.
- Bug 5 is under-fixed:
  - The current time sorter only parses raw `HH:MM`, so `3:15 PM` vs `5:30 PM` can still sort incorrectly.
  - Ordering is being enforced too early instead of at the final outbound/save stage.

Implementation plan

1. Stop backend meal fallback from masking broken or ungenerated days
- Update `enforceRequiredMealsFinalGuard()` in `supabase/functions/generate-itinerary/day-validation.ts` so it refuses to inject meals when a day has no real non-logistics activities.
- Add a returned flag such as `isUngeneratedDay` / `skipInjectionReason` so callers can distinguish “missing one meal” from “this day never generated”.
- In both `generate-day` and `generate-trip-day` save paths in `supabase/functions/generate-itinerary/index.ts`, if a day is effectively empty:
  - do not inject meals,
  - mark the day as ungenerated,
  - surface it as a generation failure / partial generation condition instead of accepting the shell.
- Preserve `chain_broken_at_day` metadata and use it as the source of truth for incomplete itineraries.

2. Make incomplete generation visible in the UI instead of hiding it
- In `src/pages/TripDetail.tsx`, add a persistent incomplete-generation banner when:
  - `metadata.chain_broken_at_day` exists, or
  - any loaded day is flagged `_ungenerated`, or
  - completed days are lower than expected.
- Reuse the existing resume flow (`handleResumeGeneration`) for the action, but change the copy so users clearly understand some days are incomplete rather than merely “paused”.
- For day rendering, show a clear incomplete-day state instead of generic meals if a day is flagged `_ungenerated`.

3. Strengthen sanitization and run it at the final output boundary
- In `supabase/functions/generate-itinerary/sanitization.ts`, broaden the leak patterns so they catch:
  - unicode dash ranges in booking text (`2–4`, `2—4`),
  - longer self-commentary phrases (`wellness interest specifically`, `aligns with your request`, etc.),
  - more schema leak field names and punctuation variants.
- Add a final “last pass” sanitization call in `supabase/functions/generate-itinerary/index.ts` after all post-processing, dedup, meal enforcement, hotel cleanup, and title normalization — not just right after JSON parse.
- Remove or rewrite backend meal-fallback copy that still produces visible placeholder text like “Find a real restaurant”.

4. Fix phantom hotel generation at both prompt and post-processing layers
- In `supabase/functions/generate-itinerary/index.ts` and any shared prompt builder used by day generation, gate all hotel check-in / return-to-hotel instructions behind real hotel presence.
- When no hotel exists, inject explicit prompt rules:
  - no hotel check-in/check-out cards,
  - no named hotel fabrication,
  - use generic accommodation wording only if absolutely necessary.
- In `supabase/functions/generate-itinerary/sanitization.ts`, add a new strip step that removes accommodation activities entirely when no hotel is booked, instead of only replacing the fabricated brand name.
- Keep `enforceHotelPlaceholderOnDay()` as a secondary fallback, but no longer treat it as the main fix.

5. Replace exact-match cross-day dedup with concept-based dedup
- Refactor `deduplicateCrossDayVenues()` to use the stronger concept-similarity/location-based logic already present elsewhere in the generation code.
- Dedup by:
  - normalized venue title,
  - `location.name`,
  - concept similarity for renamed variants of the same attraction.
- Keep meals, transport, and legitimate recurring logistics exempt.
- Run this right before persistence, so no later transformation can reintroduce duplicates.

6. Rebuild chronological ordering using robust time normalization
- Replace the current sanitization time parser with one that understands both 24h and 12h strings.
- Normalize `startTime`, `endTime`, and `time` into a comparable form before sorting.
- Enforce ordering as the final structural pass before save/return, not earlier in sanitization only.
- If overlaps are corrected, shift both start and end while preserving duration.

Files to update
- `supabase/functions/generate-itinerary/index.ts`
- `supabase/functions/generate-itinerary/day-validation.ts`
- `supabase/functions/generate-itinerary/sanitization.ts`
- `supabase/functions/generate-itinerary/prompt-library.ts` (if hotel bookend rules are sourced there)
- `src/pages/TripDetail.tsx`
- Possibly the day UI component that renders incomplete days, if it needs explicit empty-state messaging

Verification
- Re-test 4-day Paris and Tokyo generations.
- Confirm:
  - no meal-only shell days are accepted,
  - incomplete chains show a visible retry/resume state,
  - no leaked `,type` / booking urgency / self-commentary / “the destination” text,
  - no phantom hotel cards when no hotel is booked,
  - no Louvre-style attraction repeats across days even with variant titles,
  - 12h and 24h times render in correct chronological order.

This is the right next step because the current code already contains parts of the previous fix, but the remaining failures are caused by enforcement happening in the wrong layer, too early, or with weaker logic than the codebase already supports.
