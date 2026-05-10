# Time edits: persist immediately + respect locks

## Problem

`EditorialItinerary.tsx::handleUpdateActivityTime` (line 5514) has two bugs:

1. **No lock-respect.** It happily mutates the time of a locked activity and, in cascade mode, shifts every downstream activity regardless of `isLocked` / `locked` / `lock_state === 'locked'` flags. This violates the **Universal Locking Protocol** (manually added / edited / extracted / pinned activities must never be modified by AI or auto-cascades).
2. **Doesn't persist.** It only calls `setDays` + `setHasChanges(true)`. The user must hit the global Save button before the change reaches `trips.itinerary_data`. Page refresh, route change, or any concurrent backend repair (e.g. cost recompute, payments reconcile) silently throws away the edit. Other edit handlers in this file (`handleUpdateActivity` at 5619, `handleMoveToDay`, `handleCopyToDay`, `handleAddActivity`) already at least call `syncBudgetFromDays` so the cost ledger reaches the DB; time-edit doesn't even do that.

This pairs with the broader pattern of "client-only state edits silently dropped" we've fixed elsewhere (handleUpdateActivity, handleCopyToDay, etc.).

## Fix

### 1. Lock guard on the target activity

At the very top of `handleUpdateActivityTime`, after looking up `targetActivity`:

```ts
const isUnlocked = !targetActivity.isLocked && !(targetActivity as any).locked
  && (targetActivity as any).lock_state !== 'locked';
if (!isUnlocked) {
  toast.error('Unlock this activity first to change its time');
  return;
}
```

This mirrors the pattern used in `openSwapDrawer` (line 3906) and `previewCascadeOverflow` callers.

### 2. Lock-respect during cascade

Inside the cascade branch (`if (cascade && aIdx > activityIndex && deltaMinutes !== 0)`), short-circuit on locked downstream items so they keep their original times:

```ts
const downstreamLocked = activity.isLocked || (activity as any).locked
  || (activity as any).lock_state === 'locked';
if (downstreamLocked) {
  // Don't shift this one — track that we hit a lock so we can warn the user.
  hitLock = true;
  return activity;
}
```

After the map, if `hitLock`:
- Show a single info toast: `Some activities were locked and kept in place — review the schedule for overlaps.`
- Run the existing `previewCascadeOverflow` against the (partially-shifted) result so any overlaps still surface the confirm modal.

This is preferable to refusing the cascade outright — users typically expect locked anchors to act as fixed pegs the rest of the schedule flows around, not blockers.

### 3. Persist immediately

After the local `setDays` succeeds (the "Apply directly (no overflow)" branch around line 5608, plus the `applyCascadeOverflow` confirm path used when the user accepts the modal), pipe the new days through the existing `safeUpdateItineraryData` service:

```ts
import { safeUpdateItineraryData } from '@/services/safeUpdateItineraryData';
// ... after setDays:
const itineraryToPersist = { ...parsedMetadata ? { metadata: parsedMetadata } : {}, days: updatedDays, status: 'ready' };
safeUpdateItineraryData(tripId, itineraryToPersist).catch((err) => {
  console.warn('[time-edit] persist failed, will fall back to global Save:', err);
  setHasChanges(true);
});
```

`safeUpdateItineraryData` already runs through the `save-itinerary` action, which gives us:
- prompt-artifact scrub, ghost-row guard, cross-city/meal-guard pipeline.
- `preserveLedgerCosts` so we don't downgrade server-repaired Michelin/ticketed prices when the in-memory copy was serialized before a cost-repair landed.
- the Universal Locking Protocol on the server side as a second line of defence.

On success, leave `setHasChanges(false)` (the change is durable). On failure, fall back to the existing `setHasChanges(true)` so the global Save button still has something to flush.

Same call site needs to run from the `applyPendingCascade` confirm handler that accepts the overflow modal so cascade-with-truncation also persists. Locate that handler and add the identical persistence call there.

### 4. No backend changes

The fix is fully in `EditorialItinerary.tsx`. `safeUpdateItineraryData` is already wired and tested against the no-raw-itinerary-writes lint test — using it here keeps that contract intact.

## Verification

1. Edit start/end of an unlocked mid-trip activity → DB row in `trips.itinerary_data.days[i].activities[j]` reflects the new times immediately (verify with `read_query`); refreshing the page keeps the change.
2. Edit start/end of a **locked** activity → toast says "Unlock this activity first…", no state change, no network call.
3. Cascade-edit Day with one locked activity in the middle → locked activity keeps its time, downstream-of-locked activities shift as before, info toast fires once, overflow modal still appears if the cascade pushes anything past midnight.
4. Edit, then immediately reload before pressing global Save → change persists.
5. Edit while the activity has a server-repaired Michelin price floor → cost stays at the repaired value (covered by `preserveLedgerCosts` inside `safeUpdateItineraryData`).
6. Existing global Save button still works for any other queued unsaved changes (`setHasChanges` only flipped back to `true` on persistence failure).

## Out of scope

- The other client-only edit handlers (`handleUpdateActivity`, manual moves, etc.) that share the same "doesn't persist itinerary, only sync costs" gap — separate ticket; mention but don't expand here.
- Server-side dayMode recompute when activity times change — the meal-policy is keyed on flight times, not activity times, so unaffected.
