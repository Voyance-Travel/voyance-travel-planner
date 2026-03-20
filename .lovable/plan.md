

## Fix: Add confirmation dialog for activity removal + ensure copy toast is visible

### Problem
1. **Remove** — Clicking "Remove" in the ⋯ menu immediately deletes the activity with no confirmation. The only safety net is undo (via version snapshots).
2. **Copy to Day** — Already has a toast (`toast.success('Copied to Day X')` at line 4077), so this part is actually working. The user may not have noticed it.

### Changes

**File: `src/components/itinerary/EditorialItinerary.tsx`**

1. **Add state for pending removal** — Add a `pendingRemove` state (`{ dayIndex: number; activityId: string; activityTitle: string } | null`) near the other dialog states (around line 3500–3600).

2. **Replace immediate delete with confirmation** — Change `handleActivityRemove` (line 4080) to set `pendingRemove` state instead of immediately deleting. Create a new `confirmActivityRemove` function that contains the current delete logic (lines 4081–4112).

3. **Add AlertDialog** — Add a confirmation dialog (reusing the already-imported `AlertDialog` components) near the other dialogs (around line 6834). Content:
   - Title: "Remove activity?"
   - Description: "Remove **{activityTitle}** from Day {dayNumber}? You can undo this action."
   - Cancel button + destructive "Remove" button that calls `confirmActivityRemove`

### Scope
Single file: `src/components/itinerary/EditorialItinerary.tsx`. No new imports needed — `AlertDialog` is already imported.

