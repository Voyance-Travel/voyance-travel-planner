## Goal

Stop the system from ever saving a finished trip whose entire itinerary is just a hotel (or hotel + flight + check-in/out). When the generator produces such a skeleton, mark the trip as a recoverable failure and tell the UI to prompt a retry — never present a broken-but-"ready" trip to Budget Coach or the Budget tab.

## Root cause

Today, generation always finishes by writing `itinerary_status = 'ready'` (in `generation-core.ts` Stage 6, and again in `action-save-itinerary.ts`), regardless of how thin the day plans are. Downstream:

- Budget tab reads `itinerary_data` and only shows a small inline warning.
- Budget Coach has guards but still loads the trip as a normal "ready" trip.
- The user sees an over-budget hotel-only trip with no path to recover except hitting Regenerate manually.

We already compute "meaningful activity" counts in `BudgetTab.tsx` (NON_ACTIVITY_CATS / NON_ACTIVITY_TITLE_RE). We'll lift the same logic server-side and use it as a presentation gate.

## Changes

### 1. New shared helper: `countMeaningfulActivities`

File: `supabase/functions/generate-itinerary/day-validation.ts` (extend; already has day-level checks).

Add a pure helper:
- Inputs: itinerary days array.
- Excludes the same categories/titles as `BudgetTab.tsx` (hotel/accommodation/lodging/stay/flight/check-in/check-out/bag-drop/airport-transfer/return-to-hotel/departure/arrival).
- Returns `{ meaningfulCount, dayCount, daysWithZeroMeaningful }`.

Mirror the regex/category set from `BudgetTab.tsx` so client and server stay aligned.

### 2. Generation-time empty detection (Stage 6)

File: `supabase/functions/generate-itinerary/generation-core.ts` (around the Stage 6 final save, lines ~2987–3001).

Before writing `itinerary_status: 'ready'`:

- Run `countMeaningfulActivities(daysArray)`.
- If `meaningfulCount === 0` (or `< minThreshold` where minThreshold = `min(2, dayCount)`):
  - Log a structured warning: `[Stage 6] EMPTY ITINERARY DETECTED — meaningfulCount=0, days=N`.
  - Set `itinerary_status: 'failed'` and write a `metadata.generation_failure_reason = 'empty_itinerary'` field.
  - Do NOT overwrite `itinerary_data` with the empty result if a previous non-empty version exists (preserve last good state). If no prior version, write the skeleton but keep status `failed` so the UI knows to prompt retry.
  - Return early without setting `'ready'`.

This is a single, narrow gate at the one place that finalizes a trip. We deliberately do not add an automatic re-run loop here — retries are user-initiated from the existing Regenerate flow to avoid runaway credit usage.

### 3. Same gate in `action-save-itinerary.ts`

File: `supabase/functions/generate-itinerary/action-save-itinerary.ts` (around line 640).

Manual / assistant-driven saves go through this path. Apply the identical check before setting `itinerary_status: 'ready'`. If empty:
- Set `itinerary_status: 'failed'` with `generation_failure_reason = 'empty_itinerary'`.
- Return a 200 response with `{ status: 'failed', reason: 'empty_itinerary' }` so callers can show a retry prompt.

### 4. Frontend: surface the failed/empty state

File: `src/components/planner/budget/BudgetTab.tsx`

- When `trip.itinerary_status === 'failed'` AND `metadata.generation_failure_reason === 'empty_itinerary'`, replace the existing inline amber warning (lines 646–675) with a stronger banner:
  - Title: "Your itinerary didn't generate properly."
  - Body: "Generation finished without any restaurants, activities, or transit. Tap Regenerate to try again — you won't be charged additional credits for this retry."
  - Primary CTA: "Regenerate itinerary" (calls existing regenerate flow).
- Suppress all budget category bars, over-budget warnings, "Raise budget to" CTAs, and `<BudgetCoach>` mounting in this state. (Budget Coach already self-suppresses on zero suggestable; this is a belt-and-suspenders gate.)

File: `src/components/planner/itinerary/...` (wherever the Itinerary tab header lives — locate via `rg "itinerary_status" src/components`):

- Show the same failed-empty banner at the top of the Itinerary tab so the user sees it regardless of which tab they land on.

### 5. Free-retry policy for empty-generation failures

File: wherever the regenerate trigger is wired (search `regenerate` in `src/components/planner`).

When the trip is in the `failed + empty_itinerary` state, the regenerate call should pass a flag (e.g. `isEmptyRetry: true`). The generation entry point (`action-generate-trip.ts`) checks this and skips the credit charge for this single retry. This is required so the fix doesn't create a "you generated nothing — pay again" UX.

If wiring credit-skip is non-trivial, the fallback is: keep credits charged but make the UX banner clear that the previous generation didn't consume the credit (only do this if charging logic already refunds on `failed`; need to verify in code).

### Technical notes

- The "meaningful activity" definition lives in two places after this change (server day-validation.ts + client BudgetTab.tsx). Add a comment in both pointing to the other so they're kept in sync. (Edge functions can't import from `src/`.)
- Threshold choice: `meaningfulCount === 0` is the firm trigger. Optionally also fail when `meaningfulCount < dayCount` (i.e., fewer than 1 meaningful activity per day on average) — recommend keeping the strict `=== 0` rule for v1 to avoid false positives on intentionally light "rest day" trips.
- Status taxonomy already supports `failed` and `partial`. We're using `failed` + a metadata reason rather than introducing a new status, to avoid ripple changes across all status consumers.
- No DB migration needed; `metadata` is an existing JSONB column.

## Files touched

- `supabase/functions/generate-itinerary/day-validation.ts` (add helper)
- `supabase/functions/generate-itinerary/generation-core.ts` (Stage 6 gate)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (save gate)
- `src/components/planner/budget/BudgetTab.tsx` (failed-empty banner, suppress coach)
- Itinerary tab header component (failed-empty banner)
- Regenerate trigger (free-retry flag), pending verification of credit flow

## Out of scope

- Auto-regeneration loop (rejected: risk of credit burn / infinite loops on persistent generator failures).
- Refactoring all status consumers to a new dedicated `empty` status.
