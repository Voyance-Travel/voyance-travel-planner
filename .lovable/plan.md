## Problem

When you click **Re-check** or **Fix timing** in the Trip Health panel (or trigger anything similar from Travel Intel), the view jumps to the **Flights & Hotels** tab. You also can't tell whether Fix timing actually changed anything.

## Root cause

In `src/components/itinerary/EditorialItinerary.tsx`, the external-request handlers for `refresh_day` and `fix_timing` call `setActiveTab('details')`. The tab id `'details'` is the **Flights & Hotels** tab (defined at line 5537: `{ id: 'details', label: 'Details', fullLabel: 'Flights & Hotels' }`). Trip Health and Travel Intel live on the `'itinerary'` tab, so switching to `'details'` removes the user from the very panel they just clicked in.

This happens in three places (lines 2428, 2459, 2466). The success branch of Fix timing already does the right thing (no tab switch), which is why only Re-check + the fallback paths feel broken.

## Fix

1. **Remove the `setActiveTab('details')` calls** in the `refresh_day` and `fix_timing` effects. Keep the user on the `itinerary` tab.
2. **Select the affected day** (`setSelectedDayIndex(idx)`) and **scroll it into view** with `document.querySelector('[data-day-number="${dayNumber}"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })` so the user sees the day being checked/fixed.
3. **Make Fix timing feedback unambiguous**:
   - On success: keep the existing `toast.success("Resolved N timing conflict(s) on Day X")` and the auto re-check that updates the Trip Health badge to "Re-checked · no issues".
   - On `no_changes`: upgrade the toast wording to `"Day X timing already looks clean — nothing to fix."` and still trigger a re-check so the panel shows the green badge.
   - On `day_overflow` / `no_timed_activities`: still toast a warning, select the day, scroll to it, and run `handleRefreshDay(idx)` — but do **not** switch tabs.
4. Add a small `data-day-number={day.dayNumber}` attribute on the day card wrapper if it isn't already present, so scrollIntoView can target it. (If a similar attribute already exists, reuse it.)

## Files

- `src/components/itinerary/EditorialItinerary.tsx` — three handlers around lines 2418–2473, plus add `data-day-number` to the day card wrapper if missing.

No backend, schema, or AI changes.

## Verification

- Open a trip, scroll Trip Health, click **Re-check** on a day with a timing warning → stays on Itinerary tab, scrolls to that day, badge updates to "Re-checked · …".
- Click **Fix timing** on a day with overlapping activities → stays on Itinerary tab, toast shows resolved count, badge updates to "Re-checked · no issues", and the activity start/end times in the day card visibly shift.
- Click **Fix timing** on a clean day → stays on Itinerary tab, toast says nothing to fix.
