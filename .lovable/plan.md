## Bug

Editing an activity (e.g. adding a cost) has two broken behaviors that share one root function — `handleUpdateActivity` at `src/components/itinerary/EditorialItinerary.tsx:5606-5635`.

```ts
const handleUpdateActivity = useCallback((dayIndex, activityIndex, updates) => {
  setDays(prev => prev.map((day, dIdx) => {
    if (dIdx !== dayIndex) return day;
    const updatedActivities = day.activities.map((activity, aIdx) => {
      if (aIdx !== activityIndex) return activity;
      return {
        ...activity,
        ...updates,
        isLocked: true,                     // ← bug 2: force-locks every edit
        time: updates.startTime || activity.startTime || activity.time,
      };
    });
    // (sort if time changed)
    return { ...day, activities: updatedActivities };
  }));
  setHasChanges(true);
  setEditActivityModal(null);
  toast.success('Activity updated');
}, []);                                     // ← bug 1: no syncBudgetFromDays
```

### Bug 1 — Cost edit doesn't propagate to budget / payments / cost summaries

- **Where it writes:** React state only (`setDays`).
- **Where rollups read:** the `activity_costs` table (and the `v_trip_total` / `v_payments_summary` views built on top of it).
- **Why "top of card" looks stale too:** `getActivityCostInfo` and the per-card cost banner pull from the `activity_costs` snapshot via `useTripFinancialSnapshot` — see mem://constraints/payments/single-resolver-manual-fold and mem://technical/finance/ui-total-cost-fallback-logic. The card's *inline* cost line is state-driven and updates; everything aggregated (header total, Budget tab, Payments tab) reads the snapshot and stays at the old value until the next regeneration or refetch.
- **Already-correct comparator:** every other mutation site in this file (`syncBudgetFromDays` callsites at 4032, 4210, 4394, plus the swap path at 4061) calls `syncBudgetFromDays(updatedDays)` after `setDays(...)`. That helper writes the `activity_costs` row, prunes orphan rows, and dispatches the `booking-changed` event the snapshot/Payments tab listen for. **Edit is the only mutation that skips it.**
- **Autosave is not enough.** `save-itinerary` writes `trips.itinerary_data` (JSON) and the `itinerary_activities` mirror, but `activity_costs` is the canonical-cost table and is only refreshed by `syncBudgetFromDays`. No cost rollup will move until that runs.

### Bug 2 — Every edit auto-locks the activity (and feels like the itinerary itself locks)

- Line 5614 sets `isLocked: true` on every payload — even when the user only edited a cost or title and never touched the lock toggle.
- The user's "kept unlocking and saving / then it locked the itinerary" is the visible symptom of fighting this auto-lock against:
  1. The dedicated `handleActivityLock` toggle (line 4636) the user actually clicks.
  2. Any propagation that treats a fully-locked day as a hard-anchor / blocked day for AI repairs (per mem://features/itinerary/universal-locking-and-persistence-protocol). Once enough activities flip to `isLocked: true` from edits, the day looks locked to downstream features.
- Lock should be the explicit responsibility of the Lock button, not a side-effect of every save.

## Fix — narrow, frontend-only

### 1. Capture next state and call `syncBudgetFromDays`

```ts
const handleUpdateActivity = useCallback((dayIndex, activityIndex, updates) => {
  let nextDays: EditorialDay[] = [];
  setDays(prev => {
    nextDays = prev.map((day, dIdx) => {
      if (dIdx !== dayIndex) return day;
      const updatedActivities = day.activities.map((activity, aIdx) => {
        if (aIdx !== activityIndex) return activity;
        return {
          ...activity,
          ...updates,
          // Preserve current lock state unless the caller explicitly changed it.
          isLocked: 'isLocked' in updates ? updates.isLocked : activity.isLocked,
          time: updates.startTime || activity.startTime || activity.time,
        };
      });
      if (updates.startTime || updates.endTime) {
        updatedActivities.sort(/* existing comparator */);
      }
      return { ...day, activities: updatedActivities };
    });
    return nextDays;
  });
  setHasChanges(true);
  // Mirror the swap / generated-days code paths so cost rollups refresh.
  syncBudgetFromDays(nextDays);
  setEditActivityModal(null);
  toast.success('Activity updated');
}, [syncBudgetFromDays]);
```

That single addition closes bug 1 because:
- `syncBudgetFromDays` upserts `activity_costs` with the new amount/basis (manual basis takes precedence per the existing logic).
- It then dispatches `booking-changed` → `useTripFinancialSnapshot` invalidates → header total + Budget tab + Payments tab pick up the new value without a refresh.
- Autosave (3 s debounce) still runs as today and persists the cost into `trips.itinerary_data` for the next page load.

### 2. Stop auto-locking on edit

Replace `isLocked: true` (line 5614) with `isLocked: 'isLocked' in updates ? updates.isLocked : activity.isLocked`.

That keeps the activity in whatever lock state the user chose. The Lock button at line 4636 (`handleActivityLock`) remains the only thing that mutates lock state, which matches the universal-locking memory ("locked = manually added/edited/extracted/pinned" — but "edited" already means the lock toggle was clicked, not "every text update").

If product wants edited activities to lock by default, that's an explicit opt-in we can build later — a checkbox in the edit modal — not a silent default that fights every other interaction.

### Out of scope

- No backend changes. `save-itinerary` and `activity_costs` plumbing already work correctly when `syncBudgetFromDays` is invoked.
- No schema changes.
- No changes to `handleUpdateActivityTime` (line 5501) — it already runs the cascade through other paths; we can verify in passing but it's not the reported bug.
- No changes to the lock button or the universal-locking pipeline.

### Verification

1. Open an activity → set cost to $42 → Save.
   - Card cost line shows $42 ✓ (worked before).
   - Day header total ✓, Budget tab ✓, Payments tab ✓ all reflect the new $42 within ~1 s (booking-changed dispatch).
   - Network: a `POST` to `activity_costs` (or its upsert RPC, whichever `syncBudgetFromDays` uses) fires immediately, then the autosave fires 3 s later for `itinerary_data`.
2. Refresh the page → cost still $42 in every place.
3. Edit a different field (e.g. title) → activity does **not** auto-lock; existing lock state preserved. Click the Lock button → activity locks. Click again → unlocks.
4. Edit an unlocked activity many times in a row → never locks.
5. Edit a manually-locked activity → stays locked (unless the caller passes `isLocked: false`).

### Files

- `src/components/itinerary/EditorialItinerary.tsx` (single function, ~5 lines changed: capture `nextDays`, replace the `isLocked: true` line, add `syncBudgetFromDays(nextDays)` call, add dependency).
- No other files touched.