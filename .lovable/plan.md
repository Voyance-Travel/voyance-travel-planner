

## Fix: Post-Trip Page Bugs (Save, Notes, Share)

Three targeted fixes for the TripRecap / completed trip experience.

### Fix 1: Note Input Stays Open After Saving

**File: `src/components/post-trip/TripNotes.tsx`**

- Line 109: Remove `setShowAddNote(false)` from the `addNote` function
- Update toast message to "Note saved! Add another or close when done."
- Lines 274-281: Replace the Cancel/Save button pair with Save + Done buttons:
  - "Save Note" saves and keeps dialog open (clears content)
  - "Done" closes the dialog

### Fix 2: Replace Invite Share with Native Share on TripRecap

**File: `src/pages/TripRecap.tsx`**

- Lines 109-117 (hero share button): Replace `onClick={() => setShowShareCard(true)}` with native `navigator.share()` call (fallback: copy URL to clipboard)
- Lines 359-366 (bottom share button): Same — use native share instead of opening ShareTripCard
- Remove `showShareCard` state, the `<ShareTripCard>` render (lines 379-386), and the `ShareTripCard` import
- Keep the `Share2` icon and button styling

### Fix 3: Add `unsaveActivity` and `useToggleSaveActivity` Hook

**File: `src/services/tripSharingAPI.ts`**

- Add `unsaveActivity(activityId)` function that deletes from `saved_items`
- Add `isActivitySaved(activityId)` function
- Add `useToggleSaveActivity()` mutation hook with optimistic updates that calls save or unsave based on current state
- Export all new functions

Note: The TripRecap page doesn't currently have activity save buttons — it shows highlights, not individual activities. This fix adds the API infrastructure so that when activity cards with save toggles are rendered (e.g., in EditorialItinerary on completed trips), they work correctly. The `useSaveActivity` hook already exists but only saves (no toggle). The new `useToggleSaveActivity` provides proper toggle behavior.

### Files to modify

| File | Change |
|------|--------|
| `src/components/post-trip/TripNotes.tsx` | Keep dialog open after save, add Done button |
| `src/pages/TripRecap.tsx` | Replace invite share with native share, remove ShareTripCard |
| `src/services/tripSharingAPI.ts` | Add unsaveActivity, isActivitySaved, useToggleSaveActivity |

