## Goal

Make the saved DB state the **single source of truth** for what the user sees. Pre-refresh and post-refresh should render the same thing — no more "the reload changed my times / added my hotel return / dropped my dinner".

## Root Cause

After generation (and after some chat/save actions), the session holds an **in-memory** copy of the days that was assembled before the backend's final pass — `enforceTimingAndBuffers`, terminal cleanup, hotel-return bookend, post-checkout pruning, etc. The backend then runs those passes during `safeUpdateItineraryData` → `action-save-itinerary`, which re-writes `itinerary_data` to a normalized version. The session never re-reads that version, so:

- **Bali symptom**: pre-refresh times = pre-cascade; post-refresh times = post-cascade (~1.5h earlier).
- **Hotel-return symptom**: the read-time `ensureHotelReturnBookend` runs in `parseItineraryDays`, but the in-memory `generatedDays` produced by `ItineraryGenerator.fetchCompletedDaysFromBackend` are merged from `itinerary_days` rows + raw `itinerary_data.activities` and handed to the editor without going through that parser path consistently. After refresh, `parseEditorialDays` runs cleanly and the bookend appears.
- **Bruges/Istanbul symptom**: when save-itinerary's normalization rejects/drops a meal card, the session still shows the pre-save card, but the DB no longer has it. Refresh exposes the loss.

The fix is **resync, not re-normalize-on-client**. Treat any local mutation as optimistic and reconcile from DB after the server confirms.

## Plan

### 1. Add a single "resync from DB" helper in TripDetail

Create `resyncItineraryFromDb(tripId)` that:
- Reads `trips.itinerary_data, start_date, end_date, itinerary_status, metadata` once.
- Writes the result into the same `setTrip(...)` slot that handlers already use.
- Is idempotent and safe to call multiple times.
- Returns the parsed `EditorialDay[]` for callers that want to diff.

This is the single resync primitive the rest of the plan uses.

### 2. Resync after every persisted mutation

After these calls *resolve successfully*, call `resyncItineraryFromDb(tripId)`:

- `handleGenerationComplete` — after the `safeUpdateItineraryData` force-save (line ~1868). Replaces the in-memory `itineraryPayload` with whatever the backend actually persisted (post-cascade, post-bookend, post-cleanup).
- `EditorialItinerary.handleSave` and the other 3 in-component save paths that already call `safeUpdateItineraryData` / `action-save-itinerary`.
- The chat action executor's persistence callers (`rewrite/swap/regenerate/pacing/filter`) — already gated by `PersistResult.ok`; just resync after `ok`.
- Refresh-day / fix-timing flows.

This is one new call per site. No new abstractions, no behavior change beyond "what you see now matches what's on disk".

### 3. Drop the duplicate normalize on the client

`ItineraryGenerator.fetchCompletedDaysFromBackend` currently merges `itinerary_days` rows with `itinerary_data` JSON in an ad-hoc shape. After step 2 lands, the resync immediately replaces those days with the canonical JSON. So we can simplify: the generator's `onComplete` payload becomes a hand-off signal, and the `setTrip` write of `generatedDays` becomes a transient optimistic state that the resync overrides within ~100ms. No change to the celebration/ready timing.

### 4. Add a divergence sentinel (telemetry, not a fix)

In `resyncItineraryFromDb`, before overwriting state, compare the in-memory days vs the DB days at a coarse level:
- meaningful activity count per day
- terminal `endTime` per day
- presence of hotel-return bookend per day

If they differ, emit a single structured `console.warn('[ITIN_RESYNC_DRIFT]', {tripId, day, kind})`. This gives us evidence for the next round (e.g. if save-itinerary is silently dropping cards, we'll see it in logs without needing user repros).

### 5. Out of scope (intentionally)

- **Not** changing `enforceTimingAndBuffers`, `runStep8`, terminal cleanup, the no-regression guard, or any backend pass. Those are working as designed; the bug is purely that the client doesn't re-read after they run.
- **Not** removing the read-time `ensureHotelReturnBookend` — it's still useful for legacy trips and as belt-and-suspenders.
- **Not** refactoring optimistic update infrastructure. A direct `select → setTrip` resync is the smallest change that fully closes the divergence.
- No DB migrations. No new edge functions.

## Files Touched

- `src/pages/TripDetail.tsx` — add `resyncItineraryFromDb`; call it after `handleGenerationComplete`'s force-save and after the existing save handlers.
- `src/components/itinerary/EditorialItinerary.tsx` — call resync after the 3 in-component save paths.
- `src/lib/itinerary/itineraryActionExecutor.ts` (or wherever `updateTripItinerary` lives) — call resync on `PersistResult.ok`.
- `src/components/itinerary/ItineraryGenerator.tsx` — minor: keep `fetchCompletedDaysFromBackend` for the celebration handoff but document that it's transient.
- New test `src/pages/__tests__/resyncItinerary.test.ts` — unit-test the resync helper (matches DB shape, emits drift warn when diverged).
- New memory entry `mem://constraints/itinerary/db-is-source-of-truth` documenting the rule.

## Verification

1. Generate a Bali-style trip. Check that pre-refresh times == post-refresh times (Metis dinner, nightcap, hotel return).
2. Generate a Bruges-style trip with the meal-drop pattern. Pre-refresh and post-refresh meal counts must match. If save-itinerary dropped a meal, the `[ITIN_RESYNC_DRIFT]` warn fires and we have a repro to chase next.
3. Apply a chat action ("swap dinner"). After the toast, no refresh required to see the canonical version.
4. Existing `no-raw-itinerary-fallback-writes` and persist-regression tests still pass.