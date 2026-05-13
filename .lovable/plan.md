# Health Engine — Analyze Post-Cascade Times

## Why my last fix wasn't enough

The previous patch added `getDisplayStartTime(a)` that prefers `displayStartTime || adjustedStartTime || metadata.displayStart` over `startTime`. **None of those fields exist on the activity record** — render reads `a.startTime || a.time` directly. So the helper falls through to `startTime`, the same value the analyzer already had. Net effect: no change for this class of warning.

## Real architecture

Per `mem://constraints/itinerary/db-is-source-of-truth`, the FE no longer mutates `days` on load. The buffered timing cascade (`enforceTimingAndBuffers` in `src/utils/itinerary/timingCascade.ts`) runs **only at save time** — server-side in `repair-day §16` + `action-save-itinerary STEP 2.9`. The FE keeps a fingerprint-guarded **dry-run** at `EditorialItinerary.tsx:2403` that imports the same cascade, runs it against `days`, logs `[ITIN_RESYNC_DRIFT]`, but throws the result away.

That dry-run is exactly the post-adjustment view of the schedule that the user reads off the rendered cards (because the cards either already reflect a previously-saved cascade pass, or the user is looking at the schedule in the order/spacing the cascade *would* produce — same answer either way: the cascade is idempotent and the analyzer should see post-cascade times).

The Mexico City symptom (memory: `mem://constraints/itinerary/fix-timing-cascade-parity`) is the same root: analyzer races the cascade.

## Fix

**Single change**: have `analyzeHealth` run the same `enforceTimingAndBuffers` dry-run per day before reading times for the overlap/buffer pass. Conflicts the cascade resolves vanish from the panel; conflicts that survive (genuine, unresolvable) still surface.

### Implementation

1. **New helper `applyCascadeDryRun(activities, locked)`** in `src/lib/itinerary/healthCascadePreview.ts` — thin wrapper around `enforceTimingAndBuffers`. Returns a `Map<id, { startTime, endTime }>` so analyzer can look up post-cascade times by id without mutating the source. Pure, no I/O, no DB.

2. **`analyzeHealth` (TripHealthPanel.tsx)** — at the top of each day's pass, build the cascade preview map. In the overlap loop (~L209) and buffer loop (~L240), substitute `getDisplayStartTime(a)` / `getDisplayEndTime(a)` for `cascadePreview.get(a.id)?.startTime ?? a.startTime` (same for end). Keep the existing `displayStartTime`-then-`startTime` fallback chain as a tertiary so future renderers can still stamp explicit values.

3. **Update `getDisplayStartTime/End`** in `src/lib/itinerary/displayTime.ts` to accept an optional `cascadeMap` parameter: `getDisplayStartTime(a, cascadeMap?)` returns `cascadeMap?.get(a.id)?.startTime ?? a.startTime ?? a.time ?? a.start_time ?? ''`. Backward compatible.

4. **`detectGapsForDay`** — same substitution. Gaps are computed from cascade-resolved end→start, so a 10-min "conflict" the cascade fixes by pushing the next card forward will not re-emerge as a phantom gap (cascade preserves total schedule density, only shifts).

5. **Logging parity** — when a conflict is suppressed because the cascade resolved it, emit `console.debug('[health] suppressed via cascade preview', { dayNumber, before, after })` at most once per day per render. Behind `import.meta.env.DEV` so prod stays quiet.

### Files

- `src/lib/itinerary/healthCascadePreview.ts` *(new)* — `buildCascadePreview(activities, lockedIds)` → `Map<id, { startTime, endTime }>`
- `src/lib/itinerary/displayTime.ts` — extend `getDisplayStartTime/End` to read cascade map first
- `src/components/trip/TripHealthPanel.tsx` — call `buildCascadePreview` per-day inside `analyzeHealth`, pass map to display-time helper at the two read sites; same in `detectGapsForDay`
- `src/components/trip/__tests__/TripHealthPanel.cascadePreview.test.ts` *(new)* — Schwartz's-style fixture: source has overlap, expect zero overlap warnings after cascade preview; bike-tour fixture; non-cascadable conflict (two locked cards) still flagged

### Acceptance

Repro the Montreal trip Day 1 / Day 2 in the test fixtures. Before the patch, `analyzeHealth` returns the two `fix_timing` warnings the user described. After the patch, those two warnings are suppressed. A third fixture with two `locked: true` cards that genuinely overlap still flags as error (cascade can't move locked rows).

## Out of scope

- Persisting the cascade result on load — explicitly forbidden by `mem://constraints/itinerary/db-is-source-of-truth-on-load`. Read-only preview only.
- Changing `enforceTimingAndBuffers` itself — server is canonical
- Card render swap — cards keep reading `startTime || time`. The user's stated grievance is the panel disagreeing with the cards; the cascade preview makes the panel match what the user reads.

## Risk

Low. `enforceTimingAndBuffers` is pure, idempotent, already shipped. We only call it on a clone, only read from the result. The drift probe at L2403 already runs it on every render with no observed perf issue.
