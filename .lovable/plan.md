

## You're right — this is a real bug, not a stale browser

The reason your hard refresh "fixed" Day 1 of the Faro trip:

- The **database is clean** (I queried it — no 12:30 AM Ilha Deserta exists in either `trips.itinerary_data` or `itinerary_activities`).
- The browser was showing a **mid-generation snapshot** that the backend later replaced. The frontend kept the early render in memory and never swapped it out, because rendering is gated on the wrong signal.

So we're rendering Itinerary #1 (corrupt, in-flight), the backend produces Itinerary #2 (clean, finalized), but the user sees #1 until they manually reload. That's the bug.

## Why this happens today

We already have the right backend contract (the **Frozen After Ready** rule):

```text
Backend writes itinerary  →  itinerary_status = 'generated'
                          →  metadata.fully_persisted = false        ← Phase 1-3 done
                          →  enrichment + costs + cities run         ← Phase 4-5
                          →  metadata.fully_persisted = true         ← Phase 6 (final)
                          →  metadata.itinerary_frozen_at = <now>    ← canonical
```

And `TripDetail` already computes the right boolean:

```ts
// src/pages/TripDetail.tsx (already there, just unused for gating)
const fullyPersisted = meta?.fully_persisted === true;
const shouldGuard    = isServerGenerating
                    || (isReadyish && !fullyPersisted && !!trip.itinerary_data);
```

But `shouldGuard` is **only wired to the `beforeunload` warning**. The actual render switch at line 3591 still uses `isServerGenerating || generationStalled` — which flips to `false` the instant the first `itinerary_data.days` array lands, even though Phase 4-6 is still rewriting it. So the partial snapshot gets mounted in `EditorialItinerary`, and the later DB rewrite only reaches the screen via `TRIP_PERSISTED_EVENT` (which fires on edits, not on the silent backend Phase-6 flip).

## The fix — one extra gate, no architectural change

Treat "ready-but-not-fully-persisted" as **still generating** for display purposes. The backend already polls this state. We just stop showing the unfinished plan.

### Changes

1. **`src/pages/TripDetail.tsx`** — introduce a single derived boolean `isFinalizing`:
   ```ts
   const fullyPersisted = (trip?.metadata as any)?.fully_persisted === true;
   const status         = trip?.itinerary_status as string | undefined;
   const isReadyish     = status === 'ready' || status === 'generated';
   const isFinalizing   = isReadyish && !fullyPersisted && hasCompletedItineraryData;
   ```
   Then change the render branch (≈ line 3591) from:
   ```ts
   ) : isServerGenerating || generationStalled ? (
   ```
   to:
   ```ts
   ) : isServerGenerating || isFinalizing || generationStalled ? (
   ```
   and pass `isFinalizing` to `GenerationPhases` so the message reads "Finalizing your itinerary…" instead of "Generating Day N…". `useGenerationPoller` keeps polling on `fully_persisted=false`, fires `onReady` once it flips, and the canonical DB read swaps in the finalized plan in one atomic state update.

2. **`src/pages/TripDetail.tsx` `voyance:trip-loaded` dispatch (line 433)** — gate on `!isFinalizing` too, so `PersistIssuesListener` doesn't surface mid-finalize self-heal warnings as user-visible toasts.

3. **`src/hooks/useGenerationPoller.ts`** — already polls on `fully_persisted === false`. Confirm it dispatches `TRIP_PERSISTED_EVENT` on the flip (it does via the existing onReady path); no change needed beyond a guard that we only treat the trip as truly ready when both `isReadyish && fullyPersisted`.

4. **Legacy trips** (no `fully_persisted` field at all) — `isReadyish && !fullyPersisted` would falsely block them forever. Add a one-line escape: treat the absence of `fully_persisted` as `true` when `itinerary_frozen_at` is set OR the trip was created before the Phase-6 stamp shipped (`created_at < 2026-04-01`). One-liner, no migration needed.

5. **No backend change.** The contract is already correct. The leak was purely the FE rendering an unfinalized snapshot.

### What the user will see instead

- **Before:** itinerary shows up at ~6s with a corrupted Day-1, hangs there forever until manual refresh.
- **After:** the generation/finalize spinner stays up an extra few seconds (≈ Phase 4-6 duration, typically 5-15s) and the **first** itinerary the user ever sees is the finalized one. No need to know what a hard refresh is.

## Verification

- E2E: extend `e2e/itinerary-content.spec.ts` "every non-departure day ends with hotel return" to also assert that `[data-testid="day-card"]` doesn't render until `body[data-trip-finalized="true"]` (added by TripDetail when `fullyPersisted === true`). This catches any future regression of showing pre-finalize snapshots.
- Manual: re-generate the Faro trip end-to-end; the spinner should remain visible past the first itinerary write and only release once `metadata.fully_persisted=true` lands. No 12:30 AM Ilha Deserta should ever be visible.

## What this plan deliberately does NOT do

- No changes to the generation pipeline, `runStep8`, parser, bookend guards, or anything that produced the original corrupted Itinerary #1. That backend logic is already self-correcting; the only failure was showing the user the intermediate state.
- No new persistence layer or staging table. We're just consuming the existing `fully_persisted` flag.
- No auto-refresh / auto-resume. The Frozen-After-Ready and No-Regression guards still protect against the Dublin-2026-05-14 silent-overwrite class of bug.

## Memory update on apply

Add a memory entry under `mem://constraints/itinerary/no-pre-finalize-render` so this gate is enforced for every future render-path refactor.
