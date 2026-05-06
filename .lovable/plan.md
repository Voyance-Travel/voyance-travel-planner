## What's broken

You click **Fix timing** (or **Re-check**) in Trip Health and three things go wrong:

1. **The fix UI renders far below the fold.** `RefreshDayDiffView` is mounted at the very bottom of the day card (line ~10610 in `EditorialItinerary.tsx`). The page doesn't scroll to it, so it looks like nothing happened.
2. **Re-check says "no issues" but the issue line stays.** Trip Health re-derives issues from the local `days` array, which is unchanged by Re-check (Re-check is analysis-only). So the green badge appears next to a still-red issue line — confusing.
3. **After accepting proposed changes**, the issue doesn't visibly clear, and there's no "fixed!" confirmation. The flight/hotel jump is gone for `fix_timing` / `refresh_day` after the last fix, but the same parent `onAction` map (lines ~2848–2872 and ~3107–3132 in `TripDetail.tsx`) still routes some neighbor actions to `setNavigateToSection('hotels')`, which in turn forces `setActiveTab('details')`.

## Fix

### 1. Scroll & focus the fix UI when triggered

In `src/components/itinerary/EditorialItinerary.tsx`, both effects (`refreshDayRequest` and `fixTimingRequest`):

- After `setSelectedDayIndex(idx)` and `handleRefreshDay(idx)`, wait one tick and scroll to the day card. Anchor the day's wrapper with `id={`day-${day.dayNumber}`}` (find the existing day root in the render — around the `motion.div` near line ~10632 — and add the id if missing).
- After the refresh result lands and `RefreshDayDiffView` mounts, scroll the diff view into view. Add `id={`refresh-diff-${dayNumber}`}` to the diff wrapper (line 10611) and, in `handleRefreshDay`'s success branch, schedule `requestAnimationFrame(() => document.getElementById(`refresh-diff-${day.dayNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))`.
- For the **success** branch of `fixDayTiming` (line ~2447), also scroll to the day card so the user visibly sees the start/end times shift.

### 2. Trust Re-check when the server returns 0 issues

In `src/components/trip/TripHealthPanel.tsx`:

- The component already receives `refreshResultsByDay` (line ~488). Use it to **suppress** any locally-derived `timing_overlap` / `insufficient_buffer` issues for a day whose latest refresh has `errorCount + warningCount === 0`. Filter `healthIssues` so that issues with `dayNumber === N` and `fixAction === 'fix_timing'` are dropped when `refreshResultsByDay[N]` says clean.
- Recompute `healthScore` from the filtered list so the bar/badge reflect reality.

### 3. Confirm the fix landed

In `EditorialItinerary.tsx`, in the `fix_timing` effect's success branch:

- After the post-fix `handleRefreshDay`, if the result has zero issues, fire `toast.success(`Day N timing fixed — all conflicts resolved.`)`. (Currently only the resolved-count toast fires; user wants explicit confirmation.)
- After accepting proposed changes via `onApplyRefreshChanges` (defined at line ~2476), trigger a re-check on the affected day so Trip Health updates without the user clicking Re-check again. Already partially happens; ensure `refreshResultsByDay` for that day gets a fresh "no issues" entry.

### 4. Stop the residual flight/hotel jump

In `TripDetail.tsx`, the `onAction` map (both copies, lines ~2848–2872 and ~3107–3132) routes `add_intercity` to `setNavigateToSection('hotels')`. That's correct for *adding* intercity transport. But verify Trip Health isn't emitting that action when the user clicks Fix timing / Re-check — it isn't (TripHealthPanel only emits `fix_timing`/`refresh_day` for those buttons), so no change here. The earlier fix already handles the tab.

If the user is still seeing tab jumps from the **mobile** flow, confirm by reading `MobileTripOverview` to ensure it doesn't auto-collapse on action — and if it does, suppress the collapse for `fix_timing`/`refresh_day` actions so the panel stays open.

## Files

- `src/components/itinerary/EditorialItinerary.tsx` — anchors on day card and diff view; scrollIntoView calls; success-branch toast; final re-check after accept.
- `src/components/trip/TripHealthPanel.tsx` — filter local `healthIssues` against `refreshResultsByDay`.
- (Read-only check) `src/components/trip/MobileTripOverview.tsx` — confirm no auto-collapse on fix actions; small tweak only if needed.

No backend, schema, or AI changes.

## Verify

- Click **Fix timing** → page scrolls to the day, times visibly change, Trip Health issue disappears, toast: "Day N timing fixed — all conflicts resolved."
- Click **Re-check** on a day where the local check disagrees with the server → after the call, the issue line is hidden and the green "Re-checked · no issues" badge stands alone.
- Accept proposed changes from `RefreshDayDiffView` → diff dismisses, day refreshes silently, Trip Health drops the issue.
- No tab jumps to Flights & Hotels during any of the above.
