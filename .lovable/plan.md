

## Fix: "Undo Dates" restores stale checkpoint instead of last change

### Problem

The `trip_date_versions` table accumulates snapshots across sessions but never cleans up old ones. When the user clicks "Undo Dates," `restoreTripDateVersion` pops the **most recent** row — which is the snapshot saved *before* the last change. That's correct for one undo. But old snapshots from previous sessions remain in the table, so after the first undo succeeds, clicking again jumps back to an arbitrarily old state (e.g. Jul 8–12 from a prior session).

The core issue: **undo does not save the current state before restoring.** A proper undo should push the current state onto the stack so that "redo" or repeated undo works predictably. Without that, the pop-only behavior makes it a one-way time machine into old checkpoints.

Additionally, old snapshots are never pruned, so `canUndoDateChange` returns `true` even when the remaining versions are stale session artifacts.

### Fix

**1. `src/pages/TripDetail.tsx` — Save current state before restoring (lines 1905-1950)**

Before calling `restoreTripDateVersion`, snapshot the *current* trip dates so the user can undo-the-undo. This mirrors how `restoreVersion` in the per-day system works (it inserts a new version before restoring).

```
handleUndoDateChange:
  1. Save current dates as a new snapshot (action: 'undo_restore')
  2. Then call restoreTripDateVersion (which pops the PREVIOUS snapshot)
```

But this creates infinite undo loops. Better approach: **limit to single undo** — after restoring, delete ALL remaining snapshots for this trip so `canUndoDateChange` returns false and the button disappears.

**2. `src/services/tripDateVersionHistory.ts` — Add cleanup after restore**

After the pop-and-restore in `restoreTripDateVersion`, delete all remaining versions for this trip older than the one just restored. This prevents stale session artifacts from being accessible.

```typescript
// After deleting the restored version, also clean up older ones
await supabase
  .from('trip_date_versions')
  .delete()
  .eq('trip_id', tripId)
  .lt('created_at', version.created_at);
```

**3. `src/components/itinerary/EditorialItinerary.tsx` — Update button label (line ~1925 area)**

Change "Undo Dates" label to "Undo Date Change" to better communicate single-step undo semantics.

### Scope
- `src/services/tripDateVersionHistory.ts` — prune old snapshots after restore
- `src/pages/TripDetail.tsx` — save current state before undo so the restore is reversible, then clean up
- Minor label tweak in `EditorialItinerary.tsx`

