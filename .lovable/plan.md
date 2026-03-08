

## Plan: Silence Auto-Save Toast Notifications

### Problem
Every time a user makes any change on the itinerary page, the auto-save fires after 3 seconds and shows a "Changes saved" toast in the bottom-right corner. This is noisy and distracting during normal editing — users don't need confirmation that background auto-saves completed.

### Root Cause
Two `toast.success('Changes saved', { duration: 2000 })` calls in the auto-save effect (lines 2507 and 2528 of `EditorialItinerary.tsx`). These fire on every auto-save cycle.

### Fix
**File: `src/components/itinerary/EditorialItinerary.tsx`**

Remove the two `toast.success('Changes saved', ...)` lines from the auto-save effect (lines 2507 and 2528). The auto-save should be silent — it already updates `lastSaved` state which can be shown in the UI if needed.

Keep the `toast.success('Itinerary saved!')` on the manual save button (line 2609) — that's user-initiated and should have feedback.

### Scope
- **Lines 2507**: Remove `toast.success('Changes saved', { duration: 2000 });`
- **Lines 2528**: Remove `toast.success('Changes saved', { duration: 2000 });`
- Everything else stays the same — manual save toast, error toasts, and all other action-specific toasts remain.

