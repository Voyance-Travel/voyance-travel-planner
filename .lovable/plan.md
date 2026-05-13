# Morning Dead-Gap Fill

## Root cause

The user's gap is **09:15 → 12:30 on Day 2** — between breakfast (Pinky's) and lunch (José Enrique). The Density Protocol Core memory states **"Morning gaps filled with 1 paid + 1 free,"** but `supabase/functions/generate-itinerary/pipeline/fill-dead-gaps.ts` only defines two windows:

- `AFTERNOON_WINDOW` = 12:00–19:00
- `EVENING_WINDOW` = 18:00–22:00

There is no morning window. So a 3h+ hole that lives entirely in 09:00–12:00 is **never** auto-filled by the backend pipeline. It then surfaces correctly in the UI as `DeadGapBanner` ("3h 15m unplanned…"), with a manual "Suggest something" button, but no plan ever populated it in the first place.

This is a generation-time gap, not a UI defect.

## Fix

Add a third window — `MORNING_WINDOW = 09:00–12:30` — to the same file and wire it into both call sites that already invoke afternoon + evening passes.

1. **`supabase/functions/generate-itinerary/pipeline/fill-dead-gaps.ts`**
   - Add `const MORNING_START_MIN = 9 * 60;` and `const MORNING_END_MIN = 12 * 60 + 30;`.
   - Add a `MORNING_WINDOW: GapWindow = { fromMins, toMins, label: 'morning' }` and widen the `label` union to `'morning' | 'afternoon' | 'evening'`.
   - Export `fillMorningDeadGaps(activities, opts)` that defers to `fillDeadGapsForWindow(..., MORNING_WINDOW)`. Default `preferCategory` is left undefined (no dining bias — morning fillers should be culture/activity, e.g. museum, market, viewpoint).
   - Export `reportRemainingMorningDeadGap(activities, latestUsableMins?, dayNumber?)` mirroring the existing reporters.
   - The existing `isFirstDay` skip stays — arrival mornings are governed by `morning_arrival` / `brunch_day` policy, not by gap-fill.
   - Reuse the same `LOGISTICS_KEYWORDS`, `MIN_GAP_MIN = 180`, `MIN_USABLE_OVERLAP_MIN = 60` thresholds. Departure-day thin-finish (75-min) stays afternoon-only.

2. **`supabase/functions/generate-itinerary/action-generate-trip-day.ts`** (per-day chain)
   - Around line 1515 / 1543, add a third pass: `fillMorningDeadGaps(...)` invoked **before** the afternoon pass, with the same opts (destination, archetype, dietary, lockedIds, isFirstDay, isLastDay, etc.).

3. **`supabase/functions/generate-itinerary/action-generate-day.ts`** (single-day generator)
   - Around line 1337 / 1367, mirror the same morning pass before afternoon + evening.

## Out of scope

- The `DeadGapBanner` UI keeps its current behavior (manual "Suggest something" button) as the user-facing safety net for any gap the backend still leaves.
- `computeDeadGaps` (frontend detector) does not change — its 09:00–18:00 window already covers morning correctly.
- No prompt changes; `proposeGapFiller` already accepts arbitrary gap windows.
- Health panel scoring weights unchanged.

## Verification

- Re-run a fresh generation on the San Juan trip — Day 2's 09:15→12:30 hole should be populated by `fillMorningDeadGaps` with a paid culture/activity card (e.g. Castillo San Felipe del Morro, Museo de Arte de Puerto Rico, Casa Bacardí distillery) sitting roughly 10:00–12:15.
- Sentinel logs to grep: `[fill-dead-gaps][morning]` (insert + skip), and `[QUALITY] Day N has Xm unplanned 9:00-12:30` if the filler returns nothing.
- Existing afternoon/evening tests remain green; add one fixture-driven test: `fillMorningDeadGaps` inserts a card when given Pinky's 09:15 + José Enrique 12:30 on a non-first day, returns empty when `isFirstDay: true`.
- The DeadGapBanner should disappear on the freshly-regenerated day. For already-saved trips, the banner remains until the user clicks "Suggest something" or refreshes the day — that's the expected backfill path; we do not retroactively re-run gap-fill on existing JSON.
