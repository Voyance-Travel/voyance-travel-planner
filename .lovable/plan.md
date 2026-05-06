## Problem

The Trip Completion panel (`TripHealthPanel`) detects timing overlaps and renders two per-issue actions: a primary "Fix timing" button and a secondary "Re-check" (Refresh Day) button. Clicking either produces no visible effect — no spinner, no toast, no itinerary mutation.

## Root cause analysis

The wiring chain is:

```text
TripHealthPanel → onAction('fix_timing'|'refresh_day', { dayNumber })
  → TripDetail sets fixTimingRequest / refreshDayRequest { nonce }
    → EditorialItinerary useEffect on nonce → handleRefreshDay / fixDayTiming
```

There are two `TripHealthPanel` render sites in `TripDetail.tsx` (lines ~2848 and ~3107). Only the second one passes the result down through `EditorialItinerary` props (`refreshDayRequest`, `fixTimingRequest`, `onRefreshingDayChange`, `onRefreshResultsChange`). The first render path sets the same state, but if its panel is the one actually visible in the user's layout, the consumer (`EditorialItinerary`) is mounted in a different branch and the `nonce`-driven effect either never sees a new value (state is owned by the wrong subtree) or fires against `days` that don't include the requested `dayNumber` (mismatch between editor days and the panel's day numbering — e.g. preview/past-trip view).

Additional failure modes confirmed by reading the code:

1. `handleRefreshDay` in `EditorialItinerary` (line 2375) finds the day by index but the trigger effect (line 2415) finds it by `dayNumber`. If the panel emits a `dayNumber` that isn't in `editorDays` (multi-city / arrival-day / hidden days), `idx < 0` and the effect silently returns — **no toast, no error**.
2. `fix_timing` runs `fixDayTiming` which can return `{ success: false, reason: 'no_timed_activities' }` when activities lack `startTime/endTime` — currently shows `toast.info('nothing to auto-fix')` only when reason is `null`; the `no_timed_activities` branch falls through with no toast.
3. The `refresh-day` edge function call may resolve with `{ issues: [] }` (validator can't reproduce overlap because activities use `time` instead of `startTime`). The toast says "validated, no issues found" — which is exactly what the user perceives as "nothing happened".
4. There is no fallback when the panel's `editorDays` is empty (preview mode) — the buttons still render but `days.findIndex` always returns `-1`.

## Fix plan

### 1. Single source of truth for the request bus

Hoist `refreshDayRequest` / `fixTimingRequest` into a context (or pass them through both `TripHealthPanel` render sites' parents) so the request is always observed by the live `EditorialItinerary`. Remove the duplicate state setter in the unused branch.

### 2. Diagnostic guardrails in `EditorialItinerary` effects

In both nonce effects (`refreshDayRequest`, `fixTimingRequest`):

- If `idx < 0`, emit `toast.error('Day N not found in editor')` and `console.warn` instead of silently returning.
- Log entry/exit so the action is traceable in the console.

### 3. Normalize activity time fields before validation

In `handleRefreshDay`, map both `startTime`/`endTime` and the legacy `time`/`duration` shape into the `ActivityInput` payload. The validator currently misses overlaps when only `time` is set, producing the misleading "no issues" toast.

### 4. Complete `fixDayTiming` user feedback

In the `fix_timing` effect (line 2426), handle every `result.reason`:

- `no_timed_activities` → `toast.info('Day N has no timed activities to space')`.
- `day_overflow` → already handled (falls back to Refresh Day).
- `no_changes` → already handled.
- Unknown failure → `toast.error('Could not fix Day N timing')`.

### 5. Always show progress

Wrap the Re-check / Fix timing buttons with the existing `isReChecking` spinner state so the user gets immediate visual feedback even when the network call is fast or returns empty.

### 6. Verify the edge function is reachable

Run `supabase--edge_function_logs` for `refresh-day` after a click to confirm the invocation actually arrives. If it doesn't (CORS, auth), surface the error in the toast.

## Files to change

- `src/pages/TripDetail.tsx` — consolidate the two `TripHealthPanel` render branches' `onAction` handlers; ensure `refreshDayRequest` / `fixTimingRequest` are passed wherever `EditorialItinerary` is mounted.
- `src/components/itinerary/EditorialItinerary.tsx` — `handleRefreshDay` payload normalization, error toasts when day not found, complete `fix_timing` reason handling.
- `src/utils/itinerary/fixDayTiming.ts` — accept legacy `time` field as a `startTime` fallback so it can act on activities that have only `time` + `durationMinutes`.
- `src/components/trip/TripHealthPanel.tsx` — keep the existing buttons visible (no change to hover behaviour beyond confirming they are not actually hidden — the user's "hover-only" report likely refers to a layout where the row collapses on small widths; verify with the real DOM).

## Validation

1. With a trip that has a known overlap, click "Fix timing" → expect a toast like "Resolved 1 timing conflict on Day 1" and the activity card times to shift.
2. Click "Re-check" → expect spinner, then "Re-checked · no issues" pill (or warning count).
3. Trigger from a day not in the current editor view → expect explicit error toast instead of silence.
4. Inspect `refresh-day` edge function logs to confirm invocations.
