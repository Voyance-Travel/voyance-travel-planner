## Problem

"Fix Timing" (Trip Health → "Fix timing" button → `EditorialItinerary.fixTimingRequest` effect) calls `refresh-day` once, applies the time-only patches, and re-runs validation. On Rome it resolved the originally reported issues but produced 7 new errors / 2 warnings and pushed Payments into a "Reconciling…" loop.

## Root Cause

### 1. `refresh-day/index.ts` patches are non-cascading

Inside the validation loop (`supabase/functions/refresh-day/index.ts` ~lines 315–567):

- Each adjacent pair `(act, next)` may emit at most one patch for `next.id` (`changedIds.add(next.id)` gate).
- When `next` is shifted forward to clear an overlap or buffer deficit, **the activities after `next` are not shifted**. Their `patchedTimes` is never written.
- Subsequent iterations only consult `patchedTimes` for pair endpoints they recompute; they never push the cascade through the rest of the day.

Result: applying the returned `time_shift` / `buffer_added` patches in `EditorialItinerary.handleApplyRefreshChanges` moves card N forward, which now overlaps cards N+1, N+2 — manifesting as fresh `timing_overlap` / `insufficient_buffer` errors on the very next re-check. The shared `enforceTimingAndBuffers` (`supabase/functions/_shared/timing-cascade.ts`) already does the cascade correctly and is used by the generator + repair-day, but `refresh-day` predates it and was never migrated.

### 2. Fix-Timing path fires duplicate `booking-changed` events

In `EditorialItinerary.tsx`:

- `handleApplyRefreshChanges` dispatches `booking-changed` (line ~2672).
- The fix-timing effect then schedules another `handleRefreshDay` 100 ms later (line ~2620), and the autosave triggered by `setHasChanges(true)` runs in parallel.
- `PaymentsTab` listens for `booking-changed`, debounces a refetch at 600 ms, but every wave re-arms the timer; combined with the cascade-induced *new* errors creating a follow-up Refresh, the "Reconciling…" badge never clears.

The Payments loop is therefore a downstream symptom of the cascade bug — once the patch set is correct in one pass, the duplicate refetch wave goes away on its own.

## Plan

### Step 1 — Migrate `refresh-day` to the shared cascade

In `supabase/functions/refresh-day/index.ts`:

1. Keep the operating-hours pass and the checkout/airport sequence check as-is — they already produce correct patches.
2. After the operating-hours patches are computed, build the `CascadeActivity[]` list from the **post-operating-hours** times (not the originals), call `enforceTimingAndBuffers(...)` with `lockedIds` containing every `act.id` flagged as locked / pinned / extracted (read from `act.locked`, `act.userAdded`, `act.pinned`, `act.extracted` if present on the input).
3. Convert the cascade `repairs[]` into `proposedChanges`:
   - `same_start_fix` / `overlap_fix` → `type: 'time_shift'` with the new `startTime`/`endTime` from the cascaded array.
   - `buffer_fix` → `type: 'buffer_added'`.
   - `dropped_past_midnight` → new `proposedChange` `type: 'drop'` (or surface as an error issue without a patch — keep minimal: add an `issue` and skip patch so the existing UI doesn't auto-drop).
4. Issues array: emit one `timing_overlap` / `insufficient_buffer` per repair (so the panel shows what was fixed) using the `before` strings the cascade returns.
5. Preserve dedup: only one patch per `activityId`. If both operating-hours and cascade want to patch the same id, keep the operating-hours patch and re-run cascade with that id pre-shifted (already covered because we feed cascade the post-hours times).
6. Remove the bespoke pair-by-pair patch emission lines that conflict with the cascade output.

### Step 2 — Stable application in the editor

In `src/components/itinerary/EditorialItinerary.tsx`:

1. In the fix-timing effect (~line 2528), pass `lockedIds` data when constructing the activity payload so the server cascade respects them.
2. In `handleApplyRefreshChanges` (~line 2626), after applying the patches, run a **client-side** `enforceTimingAndBuffers` pass over the patched day as a safety net. (Import the same algorithm into `src/utils/itinerary/timingCascade.ts` if it isn't already exported there; reuse the existing module.) This guarantees that even if the server returns partial patches, the local commit is internally consistent.
3. Coalesce the post-fix re-check: replace the unconditional `setTimeout(handleRefreshDay, 100)` (line ~2620) with a guard that only re-runs `handleRefreshDay` when `nonTimingIssues.length > 0`. When the cascade already produced a clean day there's no point re-validating, and skipping it removes the second `booking-changed` wave.

### Step 3 — Suppress the Payments re-arm loop

In `src/components/itinerary/EditorialItinerary.tsx` `handleApplyRefreshChanges`:

- Tag the `booking-changed` event with `detail.reason: 'fix_timing'` and `detail.coalesceMs: 1200`.

In `src/components/itinerary/PaymentsTab.tsx` (~line 293 effect):

- Read `detail.coalesceMs` (default 600) and **do not** re-arm the trailing timer if one is already pending — replace the `clearTimeout` + `setTimeout` pattern with a "leading edge fired, trailing edge fires once" guard. This stops the loop where every back-to-back event resets the 600 ms window.

### Step 4 — Tests

1. Extend `supabase/functions/_shared/timing-cascade.test.ts` with a Rome-style fixture (5–6 cards, two same-start conflicts + one buffer deficit) and assert that one cascade pass leaves zero residual conflicts when re-fed into the validator.
2. Add a `refresh-day` integration test (or a small unit harness) that feeds the same fixture into the new code path and asserts the returned `proposedChanges`, when applied, produce zero new `timing_overlap` / `insufficient_buffer` issues on a second call.

### Step 5 — Memory

Add `mem://constraints/itinerary/fix-timing-cascade-parity.md`:
- Refresh-day MUST delegate timing patch generation to `enforceTimingAndBuffers`. No bespoke pair-by-pair patch emission.
- Fix Timing must not emit a follow-up `handleRefreshDay` when the cascade returned no non-timing issues.
- Payments `booking-changed` handler is leading-edge + single trailing-edge; never re-arm.

Update `mem://index.md` Core to reference the new constraint.

## Out of Scope

- No changes to the Trip Health analyzer (`TripHealthPanel.tsx`) — it already filters and soaks correctly.
- No changes to AI prompts or the generator pipeline; the cascade module is shared and unchanged.
- No changes to the Payments reconciliation contract — only the event-coalescing window.

## Files Touched

- `supabase/functions/refresh-day/index.ts` (rewrite §2/3/4 of the validation loop)
- `src/components/itinerary/EditorialItinerary.tsx` (fix-timing effect + `handleApplyRefreshChanges`)
- `src/components/itinerary/PaymentsTab.tsx` (event handler debounce)
- `src/utils/itinerary/timingCascade.ts` (export shared helper if needed)
- `supabase/functions/_shared/timing-cascade.test.ts` (Rome fixture)
- `mem://constraints/itinerary/fix-timing-cascade-parity.md` (new)
- `mem://index.md` (index entry)
