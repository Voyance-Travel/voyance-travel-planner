## Problem

Madrid Day 3 health panel surfaced `Day 3 has 7h gap before Misión Café` even though the 7h window was the overnight sleep period (Day 2 ~21:40 → Day 3 ~08:30), not an intra-day gap.

Existing gap loop in `analyzeHealth` (src/components/trip/TripHealthPanel.tsx, lines 137–179) already iterates per-day via `days.forEach`, applies a `dayScopedForGap` filter, and skips wrap-past-midnight + pre-05:00 cards. The leak still happens because:

1. The scoping is inlined inside a 200-line forEach, so contributors keep adding pre/post checks against the wrong array (the pattern the comment at line 138 warns against). Refactoring to a named, single-purpose `detectGapsForDay(allActivities, dayNumber)` makes the day-boundary invariant impossible to violate.
2. Pre-dawn cutoff is hard-coded at `< 05:00`. A leftover Day 3 row with start 05:30–06:00 (e.g. an early-morning ritual mis-tagged from the night before) survives the filter and seeds `prevEnd ≈ 06:00` so a 08:30 first activity reports as a "2.5h gap"; in the Madrid trace the offending row was a 01:30 prevEnd that the wrap+preDawn pair *should* have caught — but only when the row is correctly populated. Belt-and-braces: also drop any candidate whose `startMins < firstSubstantiveStart` after sort, and never report a gap before the day's first user-visible activity.
3. We pass `realActivities` (already day-scoped by `day.activities`) plus a re-filter by `dayNumber`. We should additionally accept the *flat* activity list as the contract (matching the user's spec) so callers can never accidentally pass a polluted, cross-day array.

## Plan

### 1. Extract `detectGapsForDay`

In `src/components/trip/TripHealthPanel.tsx`:

- Add a module-level `detectGapsForDay(allActivities: any[], dayNumber: number, dayMode?: string): HealthIssue[]` that:
  - Filters by `(a.dayNumber ?? a.day_number) === dayNumber` as the FIRST step (hard day-boundary guard).
  - Reuses existing `isBookendOrTransit` predicate (lift to module scope alongside).
  - Drops cards where `endMins > 0 && endMins < startMins` (wrap-past-midnight) and `startMins < 5*60` (pre-dawn residue).
  - Sorts by `startMins`, walks consecutive pairs, emits `gap-{dayNumber}-{startMins}` issue when delta ≥ 180 min.
  - Never emits a gap before the first sorted activity (no synthetic `prevEnd = 0`).
  - Only updates `prevEnd` when `endMins > startMins` (preserves current behavior).

### 2. Wire into `analyzeHealth`

- Replace the inline gap loop (lines 137–179) with:
  ```ts
  const gapIssues = detectGapsForDay(activities, dayNum, dayMode);
  issues.push(...gapIssues);
  ```
- Keep `realActivities`, meal, thin-day, conflict, and buffer checks unchanged — scope of this fix is gap detection only.

### 3. Tests

Add `src/components/trip/__tests__/TripHealthPanel.detectGapsForDay.test.ts` (vitest) covering:
- Day 2 ending 21:40, Day 3 starting 08:30 → no gap on Day 3 (overnight, cross-day).
- Day 3 with intra-day 13:00 lunch ending and 20:00 dinner start → emits 7h gap.
- Day 3 first activity 08:30 with no prior → no gap (no synthetic pre-dawn anchor).
- Day 3 with a wrap-past-midnight nightcap mis-tagged as day 3 → skipped, no gap.
- Bookend/transit-only day → no gaps.
- Polluted input where caller passes the full flat activity list → only day-N rows considered.

### 4. Memory

Append a one-liner to `mem://index.md` Core under the existing health-engine cluster:

> Health-engine gap detection MUST go through `detectGapsForDay(allActivities, dayNumber)` — never iterate a flat or cross-day array. Overnight sleep window (last activity of day N → first activity of day N+1) is never a gap.

And a memory file `mem://constraints/itinerary/health-gap-day-scoping` capturing the day-boundary invariant and the named-function contract.

## Out of Scope

- No changes to conflict/buffer/meal/thin-day detection.
- No changes to server-side density-protocol or repair pipeline.
- No UI/copy changes in the panel.

## Verification

- Run new vitest file: `bunx vitest run src/components/trip/__tests__/TripHealthPanel.detectGapsForDay.test.ts`.
- Manual: open a 3-day Madrid trip with Day 2 ending 21:40 and Day 3 starting 08:30 — confirm no `7h gap before Misión Café` warning. Add a synthetic 13:00→20:00 intra-day gap on Day 3 and confirm the warning DOES fire.

## Files Touched

- `src/components/trip/TripHealthPanel.tsx` (extract function + wire-in)
- `src/components/trip/__tests__/TripHealthPanel.detectGapsForDay.test.ts` (new)
- `mem://constraints/itinerary/health-gap-day-scoping` (new)
- `mem://index.md` (one-liner addition)
