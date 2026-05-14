## What this issue actually is

A real restaurant card (e.g., "Katsukura Sanjo Honten") with **no `startTime`/`start_time`/`time`** at all is being persisted into `trips.itinerary_data` for the departure day. Because it has no time, `dayChronoKey` sort treats it as `-1` and parks it after every timed card — including the airport transfer — so the user sees a "floating Lunch" after they've already left for the airport.

This isn't new. We've patched it many times (memory entries: *Validation Gate Logistics-Sequence Drop*, *Canonical Time Field Promotion*, *Departure-Day Final Enforcement §15z*, *Departure-Day Hotel-Return Strip*). The server pruner in `repair-day.ts §15z` is correct today — it drops untimed non-logistics non-locked cards on departure days regardless of category. The reason it still reproduces 14/14 is **not** a bug in §15z. It's that:

1. **§15z doesn't run on every persist path.** It runs in `repair-day` (full repair), `action-save-itinerary` (STEP 2.65), the chain finalizer (`[CHAIN_DEPARTURE_NET]`), and `action-sync-tables` (`[SYNC_DEPARTURE_NET]`). Anything that writes `trips.itinerary_data` outside those four paths — chat-action executor sub-paths, optimistic patches, undo/redo, manual reorder — can land an untimed dining row that survives.
2. **There is no read-time guard.** `itineraryParser.ts` Step 4b-pre only strips *hotel-return* cards on departure day. It does NOT strip generic untimed non-logistics cards. So even when §15z dropped the row server-side on a future write, an already-persisted legacy trip surfaces it on every page load — which is why the user sees it on existing reloaded trips.

The user confirmed: time slot is **fully blank**, repros on **both fresh and reloaded**, wants a **targeted patch + universal read-time strip**.

## Fix

Two layers, mirroring the pattern we already use for the hotel-return strip.

### Layer 1 — Persist-boundary safety net (catches future writes)

`safeUpdateItineraryData` is the single client write chokepoint. Add a deterministic, side-effect-free pre-write pass that, for the last day of every trip, drops any non-logistics, non-locked, non-userAdded/extracted/pinned card whose `startTime|start_time|time` is missing or unparseable. Reuses the same exemption rules as §15z (no scope creep — locked rows, user-added rows, `preserveAsManualPick` *with a valid time before cutoff*, and logistics rows are always kept).

Sentinel: `[PERSIST_DEPARTURE_UNTIMED_PRUNED] day=N count=K titles=…`.

This closes the chat-action / optimistic-patch / undo-redo gap without auditing every caller.

### Layer 2 — Read-time strip in the parser (catches legacy persisted rows)

In `src/utils/itineraryParser.ts` Step 4b-pre, after the existing departure-day hotel-return strip, run a second pass on the same `departureDayIdx` that drops untimed non-logistics, non-locked, non-userAdded cards. Same exemption shape as §15z. Pure UI strip, never written to DB.

Sentinel: `[itineraryParser] departure-day untimed strip day=N count=K`.

This is what makes the bug "never reproduce again" on already-persisted bad trips, including the 14/14 repros the user is looking at right now.

### Layer 3 — One-shot backfill

Run a SQL one-shot over `trips` where `metadata.itinerary_status ∈ ('ready','generated')` and the last day's JSON contains an untimed non-logistics row, dispatch through the standard `enforceDepartureDayLogistics` migration path so the on-disk JSON is clean for the affected trips. Same ring-buffer + persist-regression-guard rules apply.

### Tests

- `supabase/functions/_shared/__tests__/departure-day-combined.test.ts` — extend with a "real restaurant, category=cultural, no startTime, departure day" case.
- New `src/utils/__tests__/itineraryParser.departureDayUntimedStrip.test.ts` — fixture with a Day-N untimed dining row + airport transfer; assert the row is filtered out and a `[BOOKEND_TRACE]`-style log fires.
- New `src/lib/__tests__/safeUpdateItineraryData.departureUntimedPrune.test.ts` — assert the persist-boundary pass drops the row before write and preserves locked/userAdded rows.

### Memory

Update `mem://constraints/itinerary/canonical-time-field-promotion` (or create `mem://constraints/itinerary/departure-day-untimed-defense`) to record both new layers + the sentinels, and update the Core line in `mem://index.md`.

## Files to change

- `supabase/functions/_shared/predawn-cascade-normalize.ts` — extract a small `pickStartMin` helper if not already shared (or reuse).
- `src/lib/itinerary/safeUpdateItineraryData.ts` — add Layer 1 pass.
- `src/utils/itineraryParser.ts` — add Layer 2 pass next to existing Step 4b-pre.
- `mem://index.md` + new/updated constraint memory.
- New tests above; extend existing departure-day combined test.
- Backfill migration via `supabase--migration` (Layer 3) — runs the same enforcer SQL-side, gated by the persist-regression rules already in place.

## Out of scope

- No change to `enforceDepartureDayLogistics` itself (already correct).
- No change to chat executor / optimistic patch internals — Layer 1 is the chokepoint, by design.
- No telemetry-watching cleanup of the upstream `[DEPARTURE_UNTIMED_ACTIVITY_PRUNED]` mislabeled-category source. That's a separate generator-quality task; the fix above makes it harmless.
