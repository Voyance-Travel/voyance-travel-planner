## Day 1 timing shift on reload — root cause

Two `useEffect` blocks in `src/components/itinerary/EditorialItinerary.tsx` mutate `days` and call `setHasChanges(true)` every time the trip is loaded:

1. **Auto-buffer cascade** (lines 2387-2450) — enforces a 15-min gap between non-transport, non-same-venue back-to-back activities and pushes the *next* card later. Skips locked rows. This is what produced the Luggage-Drop 09:50 → 11:05 (+75 min cascading) shift on Day 1.
2. **Transit-cascade** (lines 2456-2489) — calls the shared `enforceTimingAndBuffers` on every load.

Pre-save already runs `enforceTimingAndBuffers` in `action-save-itinerary.ts` STEP 2.9 (line 1079), so #2 is mostly idempotent. But #1's 15-min adjacency rule is **not** mirrored backend-side, so:

- On save, server cascade leaves a 5-min adjacency alone → DB has 09:50.
- On reload, FE auto-buffer effect fires, decides 09:50 violates the 15-min rule given the prior card's endTime, pushes it, and the shift cascades through the rest of the day.
- `setHasChanges(true)` flips dirty state silently; user sees a different document than they saved.

This is the same divergence pattern locked by `mem://constraints/itinerary/db-is-source-of-truth` ("Bali times shifted ~1.5h after refresh"). Closing it requires the same recipe: one canonical pre-save normalizer, no read-time mutations.

## Fix (3 changes, all server + presentation, no business-logic shifts)

### 1. Fold the FE 15-min adjacency rule into the shared backend cascade

`supabase/functions/_shared/timing-cascade.ts` — extend `enforceTimingAndBuffers` (or add a sibling step it already runs at the end) with the exact rule from EditorialItinerary lines 2399-2438:

- For each adjacent pair `(a, b)` where neither is `transport`, neither shares `location.name`, and `b` is not locked: if `b.startTime < a.endTime + 15`, push `b` forward by the deficit and shift `b.endTime` by the same delta (skip if it would push past 23:30, matching FE).
- Apply iteratively per day so the cascade reaches downstream cards (mirrors what the FE produces today).
- Tag repairs with `reason: 'adjacency_buffer_15m'` so they show up in the existing repair-day / save-itinerary log lines.

This guarantees: whatever the FE *would* do on load is already in the JSON the DB returns.

### 2. Remove the FE on-mount mutations

`src/components/itinerary/EditorialItinerary.tsx`:

- Delete (or convert to a no-op behind a `__DEV__` invariant) the `autoBufferAppliedRef` effect at lines 2393-2450.
- Delete the `transitCascadeAppliedRef` effect at lines 2456-2489.

Rationale: with the rule moved server-side, both effects become redundant; keeping them re-introduces drift the moment a future cascade rule lands in only one place. The user's saved state becomes the rendered state. Matches the DB-is-source-of-truth contract already enforced for everything else.

We keep the cascade utility import and the explicit handlers (`handleRefreshDay`, manual edits at 2682+) — those are user-initiated and correctly persist via `safeUpdateItineraryData`.

### 3. Add a one-shot reload drift telemetry

In the same file, at the existing `[ITIN_RESYNC_DRIFT]` site (already wired per memory), extend the diff to log per-day startTime drift between session state and DB read post-`TRIP_PERSISTED_EVENT`. Observation only — no mutation. Lets us catch any remaining drift source without re-introducing the silent setState.

## Out of scope

- Changing the 15-min buffer value, the 23:30 cutoff, or transport/same-venue exemptions.
- Touching `handleRefreshDay`, manual drag-edit cascade calls, or the chat assistant's cascade re-run.
- Backfilling old trips — the next save naturally reconciles via the new pre-save step.

## Memory

Update `mem://constraints/itinerary/pre-save-timing-cascade` to note the 15-min adjacency rule is now part of the shared `enforceTimingAndBuffers` and that FE on-mount cascade effects are forbidden (must rely on pre-save). Add a one-line entry to `mem://index.md` Core if not already covered by the existing DB-is-source-of-truth bullet.

## Files

- `supabase/functions/_shared/timing-cascade.ts` — add adjacency rule + test
- `supabase/functions/_shared/timing-cascade.test.ts` — adjacency idempotency case
- `src/components/itinerary/EditorialItinerary.tsx` — remove two on-mount effects, optional drift log
- `mem://constraints/itinerary/pre-save-timing-cascade` — update
- `mem://index.md` — touch entry if needed
