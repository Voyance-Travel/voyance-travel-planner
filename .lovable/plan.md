# Fix Trip Health "Refresh Day" silent failure & stale issue count

## Problem
1. **Silent failure**: `handleRefreshDay` in `EditorialItinerary.tsx` only toasts on success. When the `refresh-day` edge function errors, `useRefreshDay` catches it and returns `null`; nothing is shown to the user.
2. **No loading feedback in the panel**: The "Review" button in `TripHealthPanel` fires `refresh_day` and returns immediately. The button stays clickable and gives no spinner/state change.
3. **"3 issues" badge never updates**: The badge in `TripHealthPanel` is derived from `analyzeHealth(days)`. `Refresh Day` is an analysis-only call — it does **not** mutate `days`, so the badge can't change. Users naturally expect a button labelled around fixing/refreshing to lower the count.

## Fix

### 1. Surface refresh failures (no more silent fail)
In `src/components/itinerary/EditorialItinerary.tsx` `handleRefreshDay`:
- When `result` is falsy, show `toast.error('Could not refresh Day N — please try again.')`.
- Wrap in try/finally so `setRefreshingDayNumber(null)` always runs (already does, keep).
- Also propagate the underlying error message from `useRefreshDay` (expose `error` from the hook in the destructure and include in the toast when present).

### 2. Loading + disabled state on the panel's Review button
- Add a new optional prop `refreshingDayNumber?: number | null` to `TripHealthPanel`.
- When `issue.dayNumber === refreshingDayNumber`, render the Review button as disabled with a small `Loader2` spinner and label "Reviewing…".
- Pass `refreshingDayNumber` from `TripDetail.tsx` (read it from the existing `editorialRef` / state — currently it lives inside `EditorialItinerary`; lift it via a new `onRefreshingDayChange` callback prop on `EditorialItinerary` that pushes the value up to `TripDetail` state, then forward to both `TripHealthPanel` instances).

### 3. Reflect refresh result in the panel
- After `handleRefreshDay` completes successfully, the existing `setRefreshResults` already records the per-day issue list. Surface that count to `TripHealthPanel` via a new prop `refreshResultsByDay?: Record<number, { errorCount: number; warningCount: number }>`.
- In the issue row UI, when a `refreshResults` entry exists for that day, append a small badge after the message: e.g. `Reviewed · 0 issues` (green) or `Reviewed · 2 issues` (amber). This tells the user the action ran and shows the up-to-date count even when the static `days`-derived analysis hasn't moved.

### 4. Make the badge & Review label honest
- Rename "Review" → "Re-check" so users don't expect it to mutate the trip.
- Add a tooltip / aria-label: "Re-runs analysis. To apply fixes use Fix timing."
- Keep the primary `Fix timing` button as the only fix path (already wired and works).

## Out of scope
- Changing the `refresh-day` edge function behaviour.
- Auto-applying proposed changes from the refresh result (separate flow).
- Reworking the static `analyzeHealth` to merge with refresh results into a single source of truth.

## Files touched
- `src/hooks/useRefreshDay.ts` — no change (already exposes `error`); confirm only.
- `src/components/itinerary/EditorialItinerary.tsx` — error toast in `handleRefreshDay`; new `onRefreshingDayChange` and `onRefreshResultsChange` callbacks fired when those values change.
- `src/components/trip/TripHealthPanel.tsx` — new `refreshingDayNumber` and `refreshResultsByDay` props; spinner + "Reviewed · N issues" badge; "Re-check" label.
- `src/pages/TripDetail.tsx` — local state `refreshingDayNumber` and `refreshResultsByDay`; receive via callbacks; forward to both `TripHealthPanel` instances.
