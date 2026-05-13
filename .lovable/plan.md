# Health Engine — False-Positive Cleanup (Montreal Audit)

## What's wrong

All four warnings on the Montreal trip are false positives from `analyzeHealth` / `detectGapsForDay` in `src/components/trip/TripHealthPanel.tsx`. The itinerary content is correct; the engine is judging it against the wrong reference.

| # | Reported | Root cause |
|---|---|---|
| 1 | Day 1 missing breakfast | `dayMode` is unset / not `morning_arrival`, so `requiredMeals` falls through to default `[breakfast, lunch, dinner]`. Arrival 09:50 should yield `morning_arrival` (no breakfast required) per the Day-1 arrival-band rule. |
| 2 | Day 1 Pointe-à-Callière 10:30–12:40 vs Schwartz's 12:30–13:30 | Schwartz's renders at **12:55** but `a.startTime` in `editorDays` still says **12:30**. Display layer shows a buffered time; analyzer reads raw source. They diverge. |
| 3 | Day 2 same pattern (Joe Beef rendered 13:27, source 12:30) | Same root cause as #2. |
| 4 | Day 3 missing dinner | Departure day with `afternoon_departure` mode should require breakfast only. Either `dayMode` is missing OR Maison Publique is an untimed floating card the engine shouldn't expect to satisfy a meal slot. |

## Fix

### A. Honor arrival/departure dayMode reliably (issues #1, #4)

In `analyzeHealth` (TripHealthPanel.tsx ~L112–131), the meal-requirement fallback chain trusts `metadata.quality.dayMode` but silently defaults to all-three-meals when it's missing. For Day 1 and the last day, derive a fallback dayMode from trip-level signals when persisted metadata is absent:

- **First day**: read `trip.flight_selection.arrival_time` (or activities-array first non-bookend `startTime`) and apply the Core arrival-band rule:
  - `< 09:30` → breakfast required
  - `09:30–11:59` → brunch day, breakfast NOT required (lunch + dinner)
  - `≥ 12:00` → lunch-first (lunch + dinner)
- **Last day**: read `trip.flight_selection.departure_time` and:
  - `≥ 18:00` → all three meals
  - `15:00–17:59` → breakfast only (afternoon_departure)
  - `12:00–14:59` → breakfast + lunch
  - `< 12:00` → breakfast only (early_departure)

Wire through a small helper `inferDayModeFallback(day, dayIndex, totalDays, tripMeta)` that's called only when `persistedMeals` and `dayMode` are both empty. This closes the silent default that produces "missing breakfast" on a 09:50 arrival and "missing dinner" on a 16:00 departure.

### B. Stop reading stale source times for overlap analysis (issues #2, #3)

The cards render with a buffered/cascade-adjusted time but `analyzeHealth` reads `a.startTime` directly. Two parts:

1. **Read the same time the card shows.** Add a single helper `getDisplayTime(a)` (in `src/lib/itinerary/displayTime.ts`) that mirrors the visual rendering: prefer `a.displayStartTime` / `a.adjustedStartTime` / `metadata.displayStart` if set by the renderer, otherwise fall back to `a.startTime`. Use it in `analyzeHealth` (L194–207) and `detectGapsForDay` (L325–326).
2. **Apply a 1-minute tolerance** before flagging overlap: only fire `conflict-day-N` when `timed[i].end - timed[i+1].start >= 1`. The current strict `>` already does this for integer minutes, but combined with point 1 this prevents the engine from racing the renderer for warnings that immediately self-resolve on save (`enforceTimingAndBuffers` is the source of truth for actual timing).

If the renderer doesn't currently stamp a `displayStartTime` on the activity object, expose it: when `EditorialItinerary` computes the card's printed time, attach it to the activity record passed to `editorDays` so health and rendering share one number.

### C. Skip untimed floating dining cards in meal-requirement check (issue #4)

In `analyzeHealth` L133–150, a missing meal is currently flagged purely from `requiredMeals - detectedMeals`. Add a guard: if a dining activity exists for the slot but has no `startTime`, count it as detected with severity downgraded — OR, on departure days specifically, skip dinner-required fallback once `flight_selection.departure_time < 18:00`. Section A already handles the latter; this adds belt-and-suspenders for orphaned untimed dining cards generally.

## Files

- `src/components/trip/TripHealthPanel.tsx` — wire `inferDayModeFallback`, swap `parseTime(a.startTime)` for `parseTime(getDisplayTime(a))` in both `analyzeHealth` overlap pass and `detectGapsForDay`
- `src/lib/itinerary/inferDayMode.ts` *(new)* — arrival/departure-band → dayMode helper, pure, unit-tested
- `src/lib/itinerary/displayTime.ts` *(new)* — single source for "what time does this card show?"
- `src/components/itinerary/EditorialItinerary.tsx` — if buffered display time is computed inline, stamp it onto the activity passed to health (read-only; no setState, no DB write)
- `src/components/trip/__tests__/TripHealthPanel.analyzeHealth.test.ts` — add cases: 09:50 arrival, 16:00 departure, buffered-display vs source-time
- `mem://constraints/itinerary/health-gap-day-scoping` — append: "Health engine reads display times via `getDisplayTime` so it never races the renderer; first/last day mealMode falls back to flight time bands when metadata is absent"

## Out of scope

- Changing `enforceTimingAndBuffers` or anything that mutates persisted timing
- Reworking the overall health score formula or weights
- Departure-day card pruning (handled by §15z `enforceDepartureDayLogistics` already)
- Generator/repair-day prompt changes — these false positives are read-side only

## Risk

Low. All changes are read-side analysis. The dayMode fallback only fires when persisted metadata is absent (today's silent path). The display-time helper only changes which timestamp the analyzer compares against — the source of truth for actual scheduling is untouched.
