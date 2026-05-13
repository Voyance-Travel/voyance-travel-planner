## Issue 4 — Same false-positive pattern, deeper root cause

The existing fixes (Issues 2 & 3) added `buildCascadePreview` + time-field canonicalization. The analyzer should already compute the museum→lunch shift to 12:54 and suppress the 9-min "conflict". The fact that it still fires on Day 3 means the cascade preview is **not being applied to this specific pair**, despite both fixes shipping.

The Casablanca trip in DB (`fce9c4ba-…7ee0dfeda783`) shows three relevant facts:

- `trips.itinerary_data.days[2]` has only **9 activities — no lunch at all**
- `itinerary_days.activities` (Day 3) also has **9 activities, no lunch**
- `itinerary_activities` table has 42 rows for Day 3, including `Lunch: Iloli 12:30–13:30` and `Art Deco Heritage 11:09–12:39`

So the warning naming "Lunch: Cabestan 12:30–13:30" is being computed against a `day.activities` array that contains the lunch row, but cascade preview is returning empty/no-shift for it. That can only happen if one of: (a) `enforceTimingAndBuffers` throws and the catch in `buildCascadePreview` returns an empty Map, (b) the activities are coming from a code path that doesn't run through `parseSingleActivity` (so no synthetic `id` and the cascade map's `if (!a?.id) continue;` drops the entry), or (c) display-time's fallback chain is returning a non-cascaded value because the cascaded entry exists but is an empty string.

We don't have telemetry to disambiguate. The plan is two-pronged: a deterministic suppression that doesn't depend on the cascade map round-trip, plus diagnostics for the remaining unknown.

## Plan

### 1. Deterministic per-pair cascade re-check in `analyzeHealth`

In `TripHealthPanel.tsx` (~line 272), before pushing a `conflict-day-N` issue, run a **final per-pair cascade simulation** on the day's activities and check whether the specific pair `(timed[i], timed[i+1])` would still overlap after `enforceTimingAndBuffers`. If the post-cascade pair has `gap >= 0`, suppress the warning.

This is independent of the existing `cascadePreview` map lookup path, so it survives:
- empty-map fallback from a thrown cascade
- id-mismatch / id-less activities
- displayTime fallback chain quirks

The simulation reuses the same engine (`enforceTimingAndBuffers`) so by definition it matches what the save-time scheduler will do.

### 2. Strengthen `buildCascadePreview` against id collisions

In `src/lib/itinerary/healthCascadePreview.ts`:
- When an activity has no `id` or duplicate `id`, key the map by `idx:N` (sort_order index) instead of dropping (`if (!a?.id) continue`).
- Have `getDisplayStartTime/EndTime` accept an optional `index` and fall back to `idx:N` lookup when id-keyed lookup misses.

### 3. Wider drift telemetry

Currently `[HEALTH_CASCADE_DRIFT]` only logs when `cascadeMap.get(id)` returns a value that disagrees with the rendered card. Add a parallel `[HEALTH_CASCADE_PREVIEW_MISS]` that fires when the analyzer is about to emit a `conflict-day-N` warning and the cascade preview Map has zero entries OR is missing an entry for one of the conflicting activities. Include `{ tripId?, day, leftId, rightId, mapSize, leftInMap, rightInMap, leftRaw, rightRaw }` so the next repro nails the exact failure mode.

### 4. Tests

In `src/components/trip/__tests__/TripHealthPanel.cascadePreview.test.ts`:
- New case: museum 11:09–12:39, lunch 12:30–13:30, both with proper ids → no `fix_timing` issue.
- New case: same scenario but lunch has `id: ''` (simulating id-less activity) → still no `fix_timing` issue (covers fix #2).
- New case: same scenario but `enforceTimingAndBuffers` throws inside the preview builder (force via mocked input that triggers the catch) → still no `fix_timing` issue (covers fix #1's deterministic re-check).

### 5. Memory

Update `mem://constraints/itinerary/health-cascade-preview` with a Round 3 invariant: "Conflict warnings are suppressed by a deterministic per-pair cascade re-check, NOT only by cascade-preview-map lookup. Adding new id-less or partially-hydrated activity sources will not regress this guarantee."

## Out of scope

- Why Day 3's `trips.itinerary_data` JSON is sparse (9 activities) while `itinerary_activities` has 42 (with duplicates) — that's a separate write-path audit.
- Cascade engine changes (Issue 2's `effectiveEnd` fix already holds).
- Any UI or styling change — health panel renders fewer warnings, no visual changes.
