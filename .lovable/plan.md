## Problem

Trip Health surfaces 3 timing overlaps (Days 1–3) but the only quick-fix offered is **Refresh Day**, which routes through `handleRefreshDay` → the AI validation/diff engine. That engine is designed for venue-closure / quality issues, not for adjusting clock times, so even when it runs the user typically sees "no proposed changes" and the overlap persists. From the user's perspective there is no way to resolve the conflicts. Health score sits at 55/100 with no actionable path forward.

## Goal

Give the user a **one-click deterministic fix** for timing overlaps that doesn't rely on the AI engine, plus contextual fallbacks if a manual review is preferred. The Refresh Day path stays for closure / quality issues.

## Plan

### 1. Add deterministic "Auto-fix timing" action

Create `src/utils/itinerary/fixDayTiming.ts`:

- Input: a day's activities (with `id`, `startTime`, `endTime`, `durationMinutes`, `category`).
- Sort by `startTime`. Walk the list; whenever `activities[i].endTime > activities[i+1].startTime`, push activity `i+1` forward so it starts at `activities[i].endTime + 5 min` buffer (or `+0` if either side is transit/transfer/walking).
- Preserve each activity's original `durationMinutes` (recompute `endTime = newStart + duration`). If `durationMinutes` is missing, derive it from the original `endTime - startTime`.
- Cap the day at 23:30 — if pushing forward would exceed it, stop and return `{ success: false, reason: 'day_overflow', resolvedCount }` so the UI can fall back to Refresh Day.
- Skip locked / pinned activities (the universal-locking memory). Treat them as immovable anchors and shift only the movable conflicting neighbour.
- Pure function + unit tests covering: simple two-activity overlap, three-activity cascade, transit pair (no buffer), locked anchor, day overflow.

### 2. Wire the action through TripHealthPanel

In `src/components/trip/TripHealthPanel.tsx`:

- For `severity: 'error'` overlap issues, change `fixLabel: 'Refresh Day'` → `fixLabel: 'Fix timing'`, `fixAction: 'fix_timing'`. Keep a secondary "Review day" button (ghost-style) that fires the existing `refresh_day` action so users can still open the AI panel.
- For the `< 5 min buffer` warning, keep `fix_timing` as primary too (it injects the 5-min buffer).
- Add a brief inline hint when `healthScore < 70`: "Tap Fix timing to auto-space overlapping activities."

### 3. Implement the action handler

In both `onAction` switches in `src/pages/TripDetail.tsx` (lines 2813 and 3059):

```ts
} else if (action === 'fix_timing') {
  if (ctx?.dayNumber) {
    setFixTimingRequest({ dayNumber: ctx.dayNumber, nonce: Date.now() });
  }
}
```

Add a `fixTimingRequest` state (mirroring `refreshDayRequest`). Pass it as a new prop to `EditorialItinerary`.

In `src/components/itinerary/EditorialItinerary.tsx`:

- New `useEffect` keyed on `fixTimingRequest?.nonce` that:
  1. Locates the day.
  2. Calls `fixDayTiming(day.activities)`.
  3. On success, calls the existing `setDays` + persistence path used by manual edits (the same one already used by drag-reorder so the day-truth ledger / activity-cost snapshot stays coherent).
  4. Shows `toast.success('Resolved N timing conflict(s) on Day X')`.
  5. On `day_overflow`, falls back to opening the Refresh Day panel and toasting "Day is too packed to auto-space — review proposed changes."

### 4. Health-score messaging

In `TripHealthPanel.tsx` reduce the per-error penalty for **timing** issues from −15 → −8 (they're trivially fixable), and add a one-line tooltip on the health pill: "Score reflects current conflicts — most can be fixed in one click." This stops the panel from looking alarmingly red while a single click can drop the score back to 95+.

## QA

1. Trip with three days each containing one overlap → click "Fix timing" on each → activities re-space, toast confirms, conflicts list empties, health score climbs.
2. Day with a locked activity in the middle → only the movable neighbour shifts; locked anchor untouched.
3. Day overflowing past 23:30 → toast routes to Refresh Day panel.
4. Refresh Day still available via secondary button for venue closures.
5. Unit tests pass for `fixDayTiming`.

## Files touched

- `src/utils/itinerary/fixDayTiming.ts` (new)
- `src/utils/itinerary/__tests__/fixDayTiming.test.ts` (new)
- `src/components/trip/TripHealthPanel.tsx` (label + action wiring + score weight)
- `src/components/itinerary/EditorialItinerary.tsx` (new prop + effect + persist)
- `src/pages/TripDetail.tsx` (state + onAction branches in both panels)

No DB migrations, no edge functions, no AI calls.