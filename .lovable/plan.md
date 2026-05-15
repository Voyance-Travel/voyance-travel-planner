## Bug 3 — Health engine false positives & false negatives

The health engine already runs a dry-run cascade preview and prefers rendered times (see `mem://constraints/itinerary/health-warning-rendered-times`). Two specific gaps remain that explain the Copenhagen and Bali repros.

### Root causes

**Bali false negative (Uluwatu 11:50–13:20 vs Naughty Nuri's 12:30–13:30, missed):**
In `analyzeHealth` (TripHealthPanel.tsx ~line 412), the conflict loop computes both `renderedOverlaps` and `cascadeOverlaps`, but then unconditionally calls `pairStillOverlapsAfterCascade(...)` first. When the dry-run cascade *would* shift Naughty Nuri's start to ≥13:20, the re-check returns false and the loop `continue`s — **even though the user can see the overlap on the rendered cards right now**. The cascade hasn't been saved, so suppressing the warning is wrong whenever rendered times collide.

**Copenhagen false positive (warning said 21:50–23:50, card showed 21:50–22:50):**
The card's time row in `EditorialItinerary.tsx` (~line 11519) uses `activity.endTime` directly via `formatTime`. The engine uses `getDisplayEndTime(a, undefined, idx)` whose precedence chain is `displayEndTime → adjustedEndTime → metadata.displayEnd → endTime → end_time`. They are not the same source. When `endTime` is missing on the source row, the engine's `renderedEnd` falls through to the cascade-synthesized end (start + `durationMinutes`), and the warning text echoes that synthesized 23:50 instead of what the card actually rendered (22:50, or start-only). The two systems disagree on what "rendered" means.

### Fix plan (frontend-only, presentation layer)

1. **Stop suppressing visible overlaps (Bali fix).** In `analyzeHealth` conflict loop, change the suppression branches so the per-pair cascade re-check + "cascade-only" suppression only fire when `renderedOverlaps === false`. If the rendered times overlap, always emit the warning. Update the existing comment block at lines 412–445 to reflect the new invariant: *cascade suppression is a tool for hiding dry-run-only artifacts, never for hiding what the user can see*.

2. **Single rendered-time helper shared by card + engine (Copenhagen fix).** Add `getRenderedStartTime(a)` / `getRenderedEndTime(a)` in `src/lib/itinerary/displayTime.ts` that mirror the card's actual precedence: prefer `startTime`/`endTime` (and `start_time`/`end_time`) verbatim, never read forward-compat display fields, and never synthesize from duration. Switch the card render in `EditorialItinerary.tsx` (~line 11519, plus mobile/grid time rows at ~11694, ~11862) to call the helper. Switch the engine's "rendered" reads in `TripHealthPanel.tsx` (lines 245–247 drift telemetry, 317–318 warning-text source, and `detectGapsForDay` if it touches rendered times) to call the same helper. The cascade-preview lookups continue to use the existing `getDisplayStartTime/EndTime` (with cascade map) for *detection*; only the rendered-text source changes.

3. **Drift telemetry hardening.** Update the existing `[HEALTH_CASCADE_DRIFT]` warn at lines 237–261 and add a new `[HEALTH_RENDERED_VS_CARD_DRIFT]` warn that fires whenever the engine's rendered string disagrees with what the helper returns for the same activity. This becomes the trip-wire for any future divergence.

4. **Tests.** Add cases to `src/components/trip/__tests__/TripHealthPanel.cascadePreview.test.ts`:
   - Bali repro: two overlapping cards where the cascade *would* resolve them — assert the warning fires.
   - Copenhagen repro: card with `endTime: '22:50'`, no display fields, `durationMinutes: 120` — assert engine's warning text uses 22:50, not the synthesized 23:50.
   - Cross-check: a true cascade-only artifact (rendered times don't overlap, cascade dry-run shifts something forward) — assert no warning.

### Out of scope

- No backend changes, no save pipeline changes, no cascade engine changes.
- Bug #1 (deferred-freeze + reload guard) and Bug #2 (`PersistIssuesListener` load gate) already shipped — not retouched.
- Health-score weighting/score arithmetic untouched; only the issue-detection inputs change.

### Files

- `src/lib/itinerary/displayTime.ts` — add `getRenderedStartTime` / `getRenderedEndTime`.
- `src/components/trip/TripHealthPanel.tsx` — guard cascade suppression on `!renderedOverlaps`; switch warning-text source to renderedHelper.
- `src/components/itinerary/EditorialItinerary.tsx` — route the 3 time-row render sites through the renderedHelper.
- `src/components/trip/__tests__/TripHealthPanel.cascadePreview.test.ts` — 3 new cases.
- Memory: update `mem://constraints/itinerary/health-warning-rendered-times` to record the rendered-helper invariant + cascade-suppression-only-when-not-rendered rule.