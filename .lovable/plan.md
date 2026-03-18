

## Fix: Cascade Past Midnight — Confirmation Dialog Before Activities Are Removed

### Problem
Two code paths silently destroy activities when a cascade shift pushes them past midnight:

1. **`handleUpdateActivityTime`** (line 4388) — when the user edits a time with "Shift all following activities" enabled, `cascadeFixOverlaps()` silently drops activities that no longer fit, showing only a dismissible toast.
2. **`handleActivityAdd`** (line 4285) — inserting a new activity calls `cascadeFixOverlaps()` which can also silently drop activities.

Both call `cascadeFixOverlaps()` from `src/utils/injectHotelActivities.ts`, which filters out activities that start too late or have durations clamped below 15 minutes. The user gets no chance to cancel or review what's being removed.

### Solution — 3 changes

**1. Create a dry-run version of `cascadeFixOverlaps` (`src/utils/injectHotelActivities.ts`)**

Add a new export `previewCascadeOverflow(activities)` that runs the same logic as `cascadeFixOverlaps` but returns `{ kept: Activity[], dropped: Activity[] }` instead of silently filtering. This lets callers inspect what would be removed before committing.

**2. Add a confirmation dialog state + UI to `EditorialItinerary.tsx`**

- Add state: `pendingCascade: { dayIndex, activityIndex, startTime, endTime, dropped: EditorialActivity[] } | null`
- In `handleUpdateActivityTime`, when `cascade` is true: instead of calling `cascadeFixOverlaps` and applying immediately, first call `previewCascadeOverflow` on the shifted activities. If `dropped.length > 0`, set `pendingCascade` with the details and **return without applying**. If nothing would be dropped, apply immediately as before.
- Render an `AlertDialog` (already available in the project) gated on `!!pendingCascade` that shows:
  - Title: "Schedule overflow"
  - Description: "Shifting the schedule would remove **N** activities that no longer fit before midnight:" followed by a bulleted list of dropped activity titles.
  - **Cancel** button → clears `pendingCascade`, no changes applied
  - **"Shift anyway"** button → saves a version snapshot, applies the cascade with drops, shows success toast
- Same pattern for `handleActivityAdd`: preview first, confirm if drops > 0.

**3. Save a version snapshot before destructive cascade**

Before applying the confirmed cascade, call `saveDayVersion(tripId, ...)` with action `'before_cascade'` so the existing Undo button can restore the pre-cascade state. This already works — just needs to be called at the right point.

### Files to edit

| File | Change |
|------|--------|
| `src/utils/injectHotelActivities.ts` | Add `previewCascadeOverflow()` export |
| `src/components/itinerary/EditorialItinerary.tsx` | Add `pendingCascade` state, preview-before-apply logic in `handleUpdateActivityTime` and add-activity flow, render `AlertDialog` confirmation |

### UX Result
- If a cascade would remove 0 activities → applied instantly (no change from current behavior for safe shifts)
- If a cascade would remove ≥1 activity → dialog appears listing what would be removed, user must explicitly confirm or cancel
- After confirmation, a version snapshot is saved so Undo restores the full schedule

