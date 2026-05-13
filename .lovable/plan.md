## Root cause (Casablanca Day 1 stale-overlap warning)

The "Wander Place Mohammed V (18:44–20:29) overlaps Dinner: Le Jasmine (19:00–20:15) — 89 min conflict" warning is the same class we already partially fixed with `buildCascadePreview` ([Health Cascade Preview] memory). The preview is wired into `TripHealthPanel.analyzeHealth` and `detectGapsForDay`, yet it's still surfacing.

Tracing `src/lib/itinerary/healthCascadePreview.ts` and `src/utils/itinerary/timingCascade.ts` against the symptom (UI shows Le Jasmine post-cascade at 8:44 PM but panel reads raw 19:00) the preview is failing to move Le Jasmine for one of three reasons we can prove from the code alone:

1. **Lock detection is too narrow.** `buildCascadePreview` only marks rows locked when `a.locked || a.isLocked || a.lock_state === 'locked'`. The canonical `isActivityLocked` (`src/utils/persistDayContract.ts`) also honors `manuallyAdded`, `extracted`, `pinned`, `lockState ∈ {locked, user, manual}`. When Le Jasmine is "manually added" but not flagged on these surface fields, the renderer treats it as movable but the cascade may still skip it via a different structural classifier — guarantee parity by reusing the canonical helper.
2. **Overlap + buffer branches require `currEnd !== null`.** Same-start branch (line 188) synthesizes `anchorEnd = currStart + durationMinutes`, but the overlap branch (206) and buffer branch (226) bail when `currEnd` is missing. Activities persisted with only `startTime + durationMinutes` (common on manually inserted "Wander…" cards) silently disable the push that should have moved Le Jasmine to ~20:34.
3. **`isStructural`/`isEndOfDayBookend` only inspect `act.title`.** Records carrying `name` (no `title`) skip those classifiers — opposite direction to the bug, but it lets unrelated rows incorrectly anchor cascades and is worth fixing while we're here.

We also lack any signal when a preview disagrees with the rendered display, so reproducible cases like Mexico City / Montreal / Casablanca all bubble up the same way without a console breadcrumb.

## Plan

### 1. Cascade preview: parity with display + canonical lock set
File: `src/lib/itinerary/healthCascadePreview.ts`
- Replace inline lock predicate with `isActivityLocked` from `@/utils/persistDayContract` (covers `manuallyAdded`, `extracted`, `pinned`, `lockState`, `lock_state`, `locked`, `isLocked`).
- Before cloning, synthesize `endTime` from `startTime + durationMinutes` when endTime is missing, so the cascade's overlap/buffer branches engage. (Only on the clone — never persist.)
- Use `act.title || act.name` consistently when building the clone so the structural classifier in `enforceTimingAndBuffers` gets a usable title.

### 2. Cascade engine: cover missing-endTime branches
File: `src/utils/itinerary/timingCascade.ts`
- In the overlap branch (~206) and buffer branch (~226), compute `effectiveCurrEnd = currEnd ?? (currStart + (durationMinutes || 30))` mirroring the same-start branch. No behavior change when endTime present; closes the silent skip when it's not.
- `isStructural` / `isEndOfDayBookend`: read `act.title || act.name` (treat both as title-equivalent).

### 3. Drift telemetry — silent until a repro fires
File: `src/components/trip/TripHealthPanel.tsx` (analyzeHealth pass)
- After `buildCascadePreview`, walk the timed list once and `console.warn('[HEALTH_CASCADE_DRIFT]', {...})` for any activity whose `cascadePreview` start/end differs from `a.displayStartTime || a.startTime` by ≥1 min. Read-only; no state mutation. This is the breadcrumb we wished we had for Mexico City / Montreal.

### 4. Unit test (locks the fix in place)
File: `src/lib/itinerary/__tests__/healthCascadePreview.test.ts` (new)
- Reproduce Casablanca Day 1: Wander (`category:'exploration'`, 18:44, durationMinutes=105, no endTime), Le Jasmine (`category:'dining'`, 19:00–20:15). Assert cascade preview produces Le Jasmine startTime ≥ 20:34 and that `analyzeHealth` produces zero overlap warnings.
- Add a `manuallyAdded:true` variant on Le Jasmine asserting the canonical lock helper keeps it pinned (no false move) and the panel suppresses the overlap (locked-vs-locked is the only legitimate case left).

### 5. Memory
- Update [Health Cascade Preview] entry to record the additional invariants (synthesize endTime, canonical lock helper, drift telemetry). No new index entry needed.

## Out of scope

- Backend cascade (`_shared/timing-cascade.ts`) is the save-time enforcer and is the contract this preview mirrors. It already runs on both branches in production paths via `enforceTimingAndBuffers`; no behavioral change there beyond the matching null-endTime guards if the same code path proves missing. (Will mirror only if grep confirms the same gap; otherwise leave untouched.)
- No persistence of preview-shifted times (per [DB Is Source Of Truth On Load]).
