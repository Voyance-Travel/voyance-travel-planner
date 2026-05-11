## Problem

User generated a trip priced at **$924**, then on browser refresh the page reloaded and the total dropped to **$340** — activities had been silently removed from the persisted `trips.itinerary_data.days`.

Root cause: when a generation pass (or repair pass) produces a degraded result — fewer real activities than a previously-saved version — the system still **overwrites** `itinerary_data.days` with the degraded version. The completeness probe already detects this (`classifyItineraryCompleteness → status='empty' | 'incomplete'`), but its only response today is to flip `itinerary_status='failed'` and stamp `metadata.generation_failure_reason`. The bad `days` array gets written anyway. On the next page load, the UI happily reads the now-degraded JSON and re-prices it.

The user's explicit instruction:

> "After the primary itinerary gets rejected and we do a last-minute patch to fix it, that becomes the primary or replaces the primary. Do not let a broken primary become the main primary that goes forward on a refresh."

## Fix

Make `persistTripItinerary` (the single boundary every write goes through) refuse to clobber a healthy `days` array with a materially-worse one, and route the two known offenders (Stage 6 final save in `generation-core.ts`, and `action-save-itinerary.ts`'s empty/incomplete branch) through that guard.

### `supabase/functions/_shared/persist-itinerary.ts`

Add a regression-protection step **between current step 3 (duration normalize) and step 4 (write)**:

1. Load the existing row: `select itinerary_data, itinerary_status from trips where id = tripId` (single round-trip — keep it cheap).
2. Build a `summarize(days)` helper returning `{ meaningfulCount, paidMeaningfulCount, dayCount, totalDays }` using the existing `classifyItineraryCompleteness` machinery so the heuristic stays in one place.
3. Compute `newSummary` and `oldSummary`. The new write is **a regression** when either:
   - `oldSummary.meaningfulCount ≥ 3` (i.e. the previous save was healthy) **AND**
   - `newSummary.meaningfulCount < max(3, oldSummary.meaningfulCount * 0.6)` **OR** `newSummary.paidMeaningfulCount < oldSummary.paidMeaningfulCount * 0.5`.
4. When a regression is detected:
   - Do **not** include `itinerary_data` in the update payload — keep the old `days`.
   - Still apply `extraUpdate` so callers can mark `itinerary_status='failed'`, stamp `metadata.generation_failure_reason`, etc.
   - Merge the rejected attempt into metadata for debugging:
     ```
     metadata.rejected_attempts = [
       ...existing,
       { at, label, oldSummary, newSummary, reason: 'regression_blocked' }
     ]   // cap at last 3
     ```
   - Log `[${label}] REGRESSION BLOCKED — keeping previous days (was=… now=…)` and add a sentinel `[PERSIST_REGRESSION_BLOCKED]` so we can grep it in edge logs.
   - Return `{ error: null, regressionBlocked: true }` (extend `PersistResult`).
5. Add an opt-out: `options.allowRegression?: boolean` for the (rare) call sites that explicitly want to overwrite — initial generation when `oldSummary.meaningfulCount === 0`, manual user reset, etc. Default `false`.

### `supabase/functions/generate-itinerary/generation-core.ts` (Stage 6)

After the `persistTripItinerary` call (~line 3102):
- If `regressionBlocked` is true, **skip** the subsequent `writeActivityCostsFromItinerary` block (lines 3122-3133) and the `trip_cities` status flip — those would re-snapshot costs from the rejected `enrichedData.days` and re-introduce the $340 number from a different angle.
- Log `[Stage 6] regression blocked — kept previous days + cost table`.

### `supabase/functions/generate-itinerary/action-save-itinerary.ts`

Same pattern: after `persistTripItinerary` (~line 963), propagate `regressionBlocked` into the response so the client toast can say "kept your previous plan — new attempt was incomplete" instead of green-checking a silent rollback.

### Call sites that need `allowRegression: true`

Audit and add the flag where overwriting is legitimate:
- The destructive clear in `action-generate-trip.ts` line 204 (`updatePayload.itinerary_data = { ...existingItData, days: [], status: 'generating' }`) — this isn't a `persistTripItinerary` call but a raw `trips.update`. Leave as-is; the guard intentionally only fires on full-content writes via the helper.
- `useUnlockTrip`, `ItineraryEditor` user-edit paths, lock toggles, optimistic updates — these typically use `skipContract: true` and have small diffs, so they won't hit the regression heuristic. Verify in passing.

### Tests

Add `supabase/functions/_shared/__tests__/persist-regression-guard.test.ts`:

1. Old save has 12 meaningful activities, new save has 3 → regression blocked, returned `{ regressionBlocked: true }`, DB update called **without** `itinerary_data`.
2. Old save has 0 meaningful (initial generation), new save has 10 → write proceeds.
3. Old save has 10, new save has 9 → write proceeds (within tolerance).
4. Old save has 10, new save has 4 with `allowRegression: true` → write proceeds.
5. `metadata.rejected_attempts` ring-buffer caps at 3 entries.

### Memory

Add `mem://constraints/itinerary/no-regression-overwrite` describing the guard, the heuristic, the `allowRegression` opt-out, and the `[PERSIST_REGRESSION_BLOCKED]` sentinel. Update `mem://index.md` Core section with a one-liner since this applies to every itinerary write.

## Files touched

```
supabase/functions/_shared/persist-itinerary.ts          (guard logic)
supabase/functions/_shared/__tests__/persist-regression-guard.test.ts   (new)
supabase/functions/generate-itinerary/generation-core.ts (skip cost-table on block)
supabase/functions/generate-itinerary/action-save-itinerary.ts (surface flag)
mem://constraints/itinerary/no-regression-overwrite      (new)
mem://index.md                                           (core line)
```

## Out of scope

- The frontend "Refresh Day" button (`refresh-day` edge function) — verified it does not persist `itinerary_data`. The bug is upstream in save paths, not in the refresh button.
- Reconstructing the lost $924 itinerary on the affected trip — once the guard ships, any future degraded attempt will be rejected; recovery of already-corrupted trips is a separate ask.
