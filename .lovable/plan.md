## Why the itinerary ignored must-do spots

Trips are created with rich setup intent stored in `trips.metadata`:
- `mustDoActivities`, `interestCategories`, `userAnchors`, `generationRules`, `celebrationDay`, `pacing`, `isFirstTimeVisitor`, `firstTimePerCity`

The generator (`action-generate-trip-day.ts`, `action-generate-day.ts`, `context-audit.ts`) reads these from `trips.metadata` every leg. They are also the source of the prompt's "must-do priorities" block and of `userAnchors` slot-pinning.

**Bug:** `persistTripItinerary` in `supabase/functions/_shared/persist-itinerary.ts` (success branch, lines 480–522) writes `updatePayload.metadata = extra.metadata` **without merging with the existing trip metadata**. Postgres treats the JSONB column as a full replacement, so every save by `action-save-itinerary.ts` overwrites the column with only `{ persist_validation, itinerary_frozen_at, fully_persisted, … }` — wiping every key set at trip creation.

Verified on trip `d1535be4…` (Beijing): the metadata column contains ONLY `persist_validation` + `itinerary_frozen_at`. All setup intent is gone. Edge logs show 8 generic `"Lunch — find a local spot in Beijing"` / `"Breakfast — find a local spot"` contract violations — the prompt no longer has the user's must-dos or interests, so the model fell back to placeholders.

Note the regression-blocked branch (lines 483–518) already does the right thing — it spreads `priorMeta` first. Only the happy path is broken.

## Fix

Single change in `supabase/functions/_shared/persist-itinerary.ts`, success branch:

1. Reuse the already-fetched `oldMetadata` (loaded around line 308–312). If absent, lazy-fetch like the regression branch already does.
2. Build `updatePayload.metadata = { ...priorMeta, ...callerMetadata }` so caller's keys (`persist_validation`, `itinerary_frozen_at`, `fully_persisted`, `quality`, etc.) win, but setup intent survives.
3. Keep current behavior of caller in `action-save-itinerary.ts` (no caller-side merge needed — defense in depth lives in the shared function).

## One-shot data backfill

For trips whose metadata was already wiped, we have no way to reconstruct must-dos from server state. Two options to surface to the user:

- **A. Do nothing structural.** Affected trips just won't have anchors on re-generation; next setup will work correctly. Recommended.
- **B. Add a "Re-add must-do spots" prompt** on TripDetail when `metadata.mustDoActivities` is missing AND `creation_source` indicates setup-form origin. Larger UX scope; skip unless requested.

## Verification

- After deploying, create a new trip with 2 must-do landmarks → generate → save → re-read `trips.metadata` and confirm `mustDoActivities` array survives.
- Re-generate the same trip's last day → confirm prompt-side `mustDoSet`/`userAnchors` still populated (log line `[generate-trip-day] mustDoLen=…`).
- Confirm `persist_validation` + `itinerary_frozen_at` still get written by save.

## Files touched

- `supabase/functions/_shared/persist-itinerary.ts` (success branch metadata merge, ~10 lines)

No frontend changes.
