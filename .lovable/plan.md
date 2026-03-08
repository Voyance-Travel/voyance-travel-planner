

# Itinerary Version History — Audit & Fix Plan

## Current State

The version history system has the building blocks (DB table with auto-incrementing versions, undo button, restore logic) but has **critical gaps** that make it unreliable:

### Gap 1: Versions NOT saved before destructive operations
`saveDayVersion()` is only called in **2 places**:
- Before **flight sync** (`before_flight_sync`)
- Before **activity import** (`before_import`)

It is **NOT called before**:
- **Day regeneration** — the most common destructive operation
- **Activity swap** — replaces an activity with an alternative
- **Activity add/delete** — modifies the day
- **Drag-and-drop reorder** — changes activity order
- **Time edits with cascade** — shifts multiple activities

This means the undo button often has nothing useful to restore.

### Gap 2: Restore is UI-only, not persisted
When `onRestore` fires, it calls `setDays()` and `setHasChanges(true)` — updating local state. But it does **not** trigger an auto-save. The user must manually hit "Save" or the changes are lost on refresh. This is fragile — a user hits undo, sees the old version, refreshes, and it's gone.

### Gap 3: No version history UI for browsing
`loadVersionHistory()` and `formatVersionLabel()` exist in the hook/service but are never exposed in the UI. Users can only do "undo last" — they can't browse or pick a specific version to restore.

---

## Fix Plan

### 1. Add `saveDayVersion` before all destructive operations
In `EditorialItinerary.tsx`, add version snapshots before:
- **`handleDayRegenerateInternal`** — save before calling the edge function (~line 3225, action: `'regenerate'`)
- **Activity swap handler** — save before replacing the activity (action: `'swap'`)
- **Activity delete** — save before removing (action: `'delete_activity'`)
- **Drag-and-drop reorder** — save before reorder commit (action: `'reorder'`)

This ensures every meaningful change has a restorable previous state.

### 2. Auto-save after restore
In the `onRestore` callback (~line 1335), after updating local state, trigger the existing `handleSave` (or a lightweight direct DB write) so the restored version is persisted immediately — not left as unsaved local state.

### 3. Add version history browser (lightweight)
Create a small `VersionHistoryDrawer` component:
- Triggered from a "History" option next to the undo button
- Lists last 10 versions using `loadVersionHistory()` + `formatVersionLabel()`
- Each row shows action label + timestamp
- Click to preview/restore that specific version
- Uses the existing `restoreVersion()` service function

### 4. Refresh undo state after saves
After each `saveDayVersion` call, call `refreshUndoState()` so the undo button appears immediately (currently it only checks on mount/day change).

---

## Files to modify
- **`src/components/itinerary/EditorialItinerary.tsx`** — add `saveDayVersion` calls before regen/swap/delete/reorder; auto-save on restore; wire up history drawer
- **`src/components/planner/VersionHistoryDrawer.tsx`** — new component for browsing version history
- **`src/hooks/useVersionHistory.ts`** — minor: expose `loadVersionHistory` and add auto-save callback option

No database changes needed — the `itinerary_versions` table and auto-increment trigger already exist.

