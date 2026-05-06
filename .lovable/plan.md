## Problem

Clicking **Fix Timing** in the Trip Health panel runs `fixDayTiming` (a local 5-minute-buffer auto-spacer), then immediately calls `handleRefreshDay` against the server `refresh-day` function. The server uses **transit-aware** buffers (walking/transit minutes + category minimums) and also reports **operating-hours** issues that `fixDayTiming` never touches. Result:

1. Local fix declares "resolved 2 conflicts" and shows success.
2. Server re-check immediately reports 7 new errors + 2 warnings (transit gaps, closed venues).
3. Health score doesn't update because the panel still sees the original `analyzeHealth(days)` issues alongside `refreshResultsByDay` (two parallel sources of truth, only the local one feeds health math).
4. `setHasChanges(true)` triggers downstream activity-cost sync + `booking-changed` dispatch, kicking the financial snapshot into a refetch loop where `bucketSum !== estimatedTotal` for several hundred ms each cycle, so Payments shows a permanent "Reconciling…" badge.

The mechanical fix works; the user-visible outcome is worse than not clicking.

## Goal

A single click on **Fix Timing** should:
- Use the same logic the server validator uses (so it can actually clear what it claims to fix).
- Update the health score the moment the day is clean.
- Not destabilize the Payments tab.

## Plan

### 1. Make Fix Timing call the authoritative validator

Replace the dual-engine flow in `EditorialItinerary.tsx` (`fixTimingRequest` effect, lines ~2466-2514).

New flow:
- Call `refreshDay()` for the selected day.
- Filter `proposedChanges` to **time-only** patches (`time_shift`, `buffer_added`) — skip `replacement` (operating-hours / closed-venue swaps) and `reorder` so we never silently move an activity the user didn't ask to move.
- Apply those patches via the existing `handleApplyRefreshChanges()` path so cascading is consistent.
- Re-run `refreshDay()` once after apply to refresh `refreshResultsByDay` (single round-trip, no recursion).
- Toast outcomes:
  - All time issues resolved → "Day N timing fixed."
  - Some non-timing issues remain (closed venues, sequence) → "Timing fixed. Day N still has N venues that need attention." with a **Review** button that opens the existing refresh diff panel.
  - Nothing to fix → "Day N timing already clean."
- Drop the local `fixDayTiming` import from this path. (Keep the file/tests for now — referenced elsewhere; mark for follow-up removal.)

### 2. Make health score reflect the latest re-check

In `TripHealthPanel.tsx` (`analyzeHealth` and the score calculation, lines 63-310):
- Already filters `fix_timing` issues away when a day's recheck returns 0 issues. Extend this so the **score** uses the same filtered list (it does — but verify the dependency on `refreshResultsByDay` is in the `useMemo` deps so the score recomputes when re-check results change).
- Add `refreshResultsByDay` to the `useMemo` dep array so the panel re-renders the score immediately after a fix.

### 3. Stop the Payments "Reconciling…" loop

The "Fix Timing" effect calls `setHasChanges(true)`, which (via the autosave + cost-sync chain in `EditorialItinerary.tsx` ~1450-1480) dispatches `booking-changed`. The financial snapshot refetches; for ~300-800 ms the new `tripTotalCents` arrives before the bucket items finish recomputing, so `bucketSumCents !== estimatedTotal` flips the badge.

Two changes in `PaymentsTab.tsx` (~lines 350-1042):
- Treat the badge as **debounced**: only show "Reconciling…" if the drift has persisted for ≥1.5 s. Use a small `useEffect` with a timer that sets a `showDriftBadge` state. Clear it on every snapshot/bucket change. This eliminates the transient flicker without hiding genuine, persistent drift.
- Also suppress the badge while `financialSnapshot.loading || isAnyRefetchInFlight`.

A timing-only fix never changes any cost row, so steady-state drift after Fix Timing must be 0. The debounce removes the false positive without weakening the real-drift signal.

### Out of scope
- The local `fixDayTiming` utility and its tests (kept; can be retired in a separate cleanup once nothing imports it).
- Operating-hours auto-replacement (still surfaced via the Refresh Day diff, not auto-applied).

## Files to edit

- `src/components/itinerary/EditorialItinerary.tsx` — rewrite the `fixTimingRequest` effect to delegate to `refreshDay` + `handleApplyRefreshChanges`.
- `src/components/trip/TripHealthPanel.tsx` — add `refreshResultsByDay` to the score `useMemo` deps; confirm filtered-issue list drives the score.
- `src/components/itinerary/PaymentsTab.tsx` — debounce the "Reconciling…" badge and hide it while snapshot is loading.

## Verification

- Click Fix Timing on a day with overlap: toast shows resolved count; refresh diff updates; health score moves up; no "Reconciling…" badge appears on Payments.
- Click Fix Timing on a day with overlap **and** a closed-venue issue: timing clears, badge counter drops to remaining non-timing count, "Review" button opens the diff panel for the swap.
- Click Fix Timing on a clean day: "already clean" info toast, no state change.