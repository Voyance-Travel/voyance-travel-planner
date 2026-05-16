# Fix Regenerate: 422 error, flicker storm, and toast spam

## What's broken
Clicking the existing "Regenerate itinerary" button on a failed/partial trip causes:
1. **422 from `generate-itinerary`** — the identity-swap / no-regression guard in `persist-itinerary.ts` blocks the new save because the prior (broken) trip still has a few rows.
2. **UI flicker + `[ITIN_RESYNC_DRIFT] cascade would still mutate on load` spam** — the drift-probe `useEffect` in `EditorialItinerary.tsx` re-fires on every realtime row update while the server chain is writing.
3. **Login-style toast storm** — global listeners (notifications, credits, friend requests, persist-issues) all re-emit during the regen burst because nothing suppresses them while `isServerGenerating` is true.

No new button, endpoint, or visual style is added. Same `handleResumeGeneration` path the user already clicks.

## Changes

1. **`src/pages/TripDetail.tsx`** — `handleResumeGeneration` passes `allowRegression: true` and `saveReason: 'user-regenerate'` through to `generate-itinerary` so the new plan can overwrite a failed/incomplete one.

2. **`supabase/functions/_shared/persist-itinerary.ts`** — no-regression guard auto-bypasses when prior `itinerary_status ∈ {failed, incomplete_itinerary}` OR caller passes `allowRegression: true`. Still stamps `metadata.rejected_attempts` for audit. Frozen-after-ready still honored unless `allowFrozenWrite`.

3. **`supabase/functions/generate-itinerary/action-generate-trip-day.ts` + `generation-core.ts`** — thread `allowRegression` from request body into every `persistTripItinerary` call in the chain.

4. **`src/components/itinerary/EditorialItinerary.tsx`** — drift-probe `useEffect` early-returns when `isServerGenerating` or `itinerary_status ∈ {generating, partial, queued}`. Kills the postMessage/dynamic-import storm and the `[ITIN_RESYNC_DRIFT]` log flood.

5. **Toast suppression during regen** — add a lightweight `isTripRegenerating(tripId)` gate (reads the same status the poller uses) and apply it in the 3 noisy listeners that fired during the storm:
   - `PersistIssuesListener` (already buffers until `voyance:trip-loaded` — extend to also drop while regenerating)
   - notifications + credits toast emitters in `TripDetail` mount effects (suppress info-level toasts when `isServerGenerating`)
   - friend-request page-load toast (already silenced for transient errors — confirm `classifyBackendError` path is taken)

6. **Memory** — update `mem://constraints/itinerary/no-regression-overwrite` to document the `failed`/`incomplete_itinerary` + `allowRegression` bypass and the regen-toast suppression rule.

## Verification
- Reproduce on the broken trip: click Regenerate → expect no 422, no flicker, no toast burst, single "Regenerating…" indicator, then normal Saved snapshot when chain completes.
- Grep: `rg "ITIN_RESYNC_DRIFT" src/` should only fire outside generation windows.
- Tests: extend `persist-itinerary` test for the failed-status bypass; add a `TripDetail.regenerate.test.tsx` asserting `allowRegression:true` is forwarded.
