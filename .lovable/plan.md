

## Why you're right

The Faro Day 1 12:05 → 15:15 gap is **190 minutes** — `detectGapsForDay` (`src/components/trip/TripHealthPanel.tsx:621`) flags ≥180 min and `computeDeadGaps` (`src/components/itinerary/TransitGapIndicator.tsx:169`) defaults to ≥180 min in a 09:00–18:00 window. Both exist but only surface as:

1. An **amber "Fill the gap" banner** above the day (editable mode only — `EditorialItinerary.tsx:10940`), or
2. A **health-panel warning** ("Day 1 has 3h gap before Vila Adentro Alleys").

Both push the user to *plan more*. Neither acknowledges that a quiet afternoon between two activities is **normal and good**. The result: the warning fires but no inline visual cue exists in the day timeline itself, so the gap looks like an oversight.

## Fix — acknowledge gaps inline, drop the alarm

Treat unscheduled time as a first-class part of the day, not a defect.

### 1) New inline "Free time" marker (visible, calm, never blocking)

Render a soft, low-chrome marker **between two consecutive activities** when:
- gap ≥ 90 min (configurable `FREE_TIME_MIN`), AND
- both activities are non-logistics (`isLogisticsActivity` reused), AND
- the existing transit row covers ≤ 30% of the gap (so a 3-min walk inside a 3h window still triggers; a 90-min transfer inside a 100-min gap does not).

Visual: a slim full-width row that lives next to the existing `TransitGapIndicator`, e.g.

```text
┌──────────────────────────────────────────────┐
│  ☕  Free time · ~3h · 12:05 – 15:15          │
│      Rest, wander, or grab a coffee.         │
│      [+ Add something]   [Keep it open]      │
└──────────────────────────────────────────────┘
```

Behavior:
- "Keep it open" dismisses for this trip/day (stored in `localStorage` keyed by `tripId:dayNumber:beforeId`); next reload still shows the marker (it's the day's true state) but in a smaller, single-line form.
- "+ Add something" reuses the existing `onAddActivity(beforeIndex)` flow.
- Copy varies by gap size: 60–119 min → "Short break", 120–239 min → "Free time", ≥ 240 min → "Long open block".

Implementation: new component `src/components/itinerary/FreeTimeMarker.tsx`; computed via a new exported `computeOpenWindows(activities, transitMap)` in `TransitGapIndicator.tsx` (shares filters with `computeDeadGaps`, returns one entry per qualifying gap with `{beforeIndex, fromTime, toTime, minutes, transitMinutes}`). Insertion point: inside `DraggableActivityList renderItem` between consecutive items, just like `TransitGapIndicator` is rendered today.

### 2) Downgrade the health-panel "3h gap" warning

`detectGapsForDay` keeps detecting, but:
- **Severity** changes from `warning` → `info` for gaps already covered by an inline `FreeTimeMarker` (computed the same way; identity = `(dayNumber, beforeIndex)`).
- **Copy** changes from "Day 1 has 3h gap before X" → "Day 1 has ~3h of open time between Y and X — shown inline."
- **Fix label** changes from `Fill Gap` → `View` (scrolls to the marker) or hidden entirely when severity is `info`.
- The "1 activity has no travel buffer" warning stays (that's a different signal: too-tight transit, not too-loose).

This keeps the health score honest (a 6h empty hole is still surfaced; a normal post-lunch break is not) without yelling at the user.

### 3) "Fill the gap" amber banner stays, but only for ≥240 min

The top-of-day `DeadGapBanner` (`EditorialItinerary.tsx:10940`) currently triggers at the same 180-min threshold as the inline marker, which double-flags the same gap. Raise its threshold to 240 min by passing `{ minMinutes: 240 }` to `computeDeadGaps` in that one call site. Below 4 hours, the inline marker alone is enough.

## Files changed

- `src/components/itinerary/TransitGapIndicator.tsx` — export `computeOpenWindows`; no behavior change to `computeDeadGaps` (still 180 default).
- `src/components/itinerary/FreeTimeMarker.tsx` — new ~80-line component.
- `src/components/itinerary/EditorialItinerary.tsx` — render `<FreeTimeMarker>` between activities; raise top-banner threshold to 240 min.
- `src/components/trip/TripHealthPanel.tsx` — `detectGapsForDay` returns `severity: 'info'` + softer copy when the gap qualifies as a `FreeTimeMarker` window.
- Tests:
  - `src/components/itinerary/__tests__/computeOpenWindows.test.ts` — new (3 cases: 95-min short break, 190-min free time, 5h long-open).
  - `src/components/trip/__tests__/TripHealthPanel.detectGapsForDay.test.ts` — add case: 190-min gap returns `severity: 'info'` + "shown inline" copy.

## What this plan deliberately does NOT do

- **No auto-insertion** of a fabricated "Coffee at a nearby cafe" activity. The marker is a label, not a generated card.
- **No backend changes.** Generator does not need to know about free-time; it's a render-time acknowledgment.
- **No change to the density protocol or the per-day meal/activity minimums.** A day with 3h of free time AND 3 paid + 2 free activities is still healthy.
- **No removal of the gap detector.** It still feeds the health panel — just at info severity for normal-sized gaps.

## Verification

- Open Faro trip, Day 1: an inline "Free time · ~3h · 12:05 – 15:15" marker appears between Faro Cathedral and Vila Adentro Alleys. The health panel still mentions the window but at info severity with "shown inline" copy. No more amber "Fill the gap" banner (190 min is below the new 240-min threshold).
- Open any trip with a 5h+ hole: both the inline marker AND the amber top-banner appear (long blocks still get an actionable nudge).
- Run added unit tests.
