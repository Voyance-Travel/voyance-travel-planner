## Bug

In `supabase/functions/generate-itinerary/pipeline/persist-day.ts:142-146`, regenerate-day deletes non-locked rows from `itinerary_activities` and re-inserts the new ones — but never touches `activity_costs`. Each per-day regen leaves the previous day's cost rows behind, so the snapshot total drifts upward.

The user's secondary claim — *"same fix needed in the full-trip-regen path"* — is **not correct**. `generation-core.ts:3375` already does `delete().eq('trip_id', tripId)` before re-inserting. Full-trip regen is clean. Fix is single-day only.

## Why the existing client cleanup isn't enough

`syncBudgetFromDays` in `EditorialItinerary.tsx` calls `cleanupRemovedActivityCosts(tripId, liveActivityIds)` (`src/services/activityCostService.ts:529`), which does delete orphans. But it only runs on *client-side* mutations (swap, edit, manual cost change, generation completion). For a server-side `regenerate-day` action, the client may never re-mount the editor in a state that re-runs that cleanup before the user opens Budget/Payments — and the issue compounds across multiple regens within the same session. The DB needs to be self-consistent without relying on a follow-up client sync.

## Fix — one site, day-scoped

Add a cleanup pass in `persist-day.ts` **after section 6** (where `normalizedActivities` has its final DB-UUID-remapped ids) and before the version save. Cleanup is scoped to the day being persisted so it cannot touch other days' rows.

```ts
// ── 6.5 Drop activity_costs rows for this day whose activity_id is no longer
// in the freshly-persisted set. Without this, every regenerate-day leaves
// orphan cost rows behind and the trip total inflates by the cost of the
// previous version's activities. (Full-trip regen handles this via
// generation-core.ts Phase 5's trip-wide delete; per-day regen needs its
// own day-scoped equivalent.)
try {
  const keepIds = normalizedActivities
    .map((a: any) => a?.id)
    .filter((v: any): v is string => typeof v === 'string' && v.length > 0);

  // activity_costs.activity_id is TEXT and may carry either the DB UUID or
  // an external_id depending on which writer ran. The remap in section 6
  // means normalizedActivities now holds the canonical (DB UUID) form for
  // freshly-inserted rows, so the keep-set covers both shapes correctly.
  let q = supabase
    .from('activity_costs')
    .delete()
    .eq('trip_id', tripId)
    .eq('day_number', dayNumber)
    .neq('source', 'logistics-sync'); // mirror client cleanup: never touch flight/hotel rows

  if (keepIds.length > 0) {
    // PostgREST `not in` syntax — quote each id for safety.
    const list = keepIds.map(id => `"${String(id).replace(/"/g, '\\"')}"`).join(',');
    q = q.not('activity_id', 'in', `(${list})`);
  }

  const { data: removed, error: cleanupErr } = await q.select('id');
  if (cleanupErr) {
    console.error('[persist-day] activity_costs day-cleanup failed (non-fatal):', cleanupErr);
  } else if (removed && removed.length > 0) {
    console.log(`[persist-day] Removed ${removed.length} orphan activity_costs rows for day ${dayNumber}`);
  }
} catch (err) {
  console.error('[persist-day] activity_costs cleanup error (non-fatal):', err);
}
```

### Design choices

- **Day-scoped, not trip-scoped.** Per-day regen must not delete other days' cost rows. `(trip_id, day_number)` is indexed — fast and safe.
- **`source != 'logistics-sync'` exclusion** mirrors the client cleanup so that flight/hotel rows are never collateral damage.
- **Empty `keepIds`** intentionally falls through to "delete every non-logistics row for this day", matching the comment in `cleanupRemovedActivityCosts:533` ("empty list means every non-logistics row is an orphan"). This is the correct semantic when a user regenerates a day into something with zero priced activities.
- **Non-fatal on error.** Cost cleanup is a hygiene step — a failed delete must not break the regen response. Logged for diagnostics.
- **Runs after section 6** so the keep-set uses the final post-remap DB UUIDs, matching what any subsequent client `syncBudgetFromDays` will produce. No risk of deleting a row we just wrote.

### Out of scope

- Full-trip regen (`generation-core.ts:3375`) — already correct, do not touch.
- `cleanupRemovedActivityCosts` (client) — unchanged; remains the safety net for client-side mutations.
- Schema changes — `activity_costs.activity_id` stays `text`; no FK retrofit. (A FK with `ON DELETE CASCADE` would be cleaner long-term but requires a type migration and is bigger than this bug.)
- Paid-row preservation policy — current cleanup helpers already delete regardless of `is_paid`. Matching that behavior keeps the new cleanup consistent with the rest of the codebase. If product wants paid rows preserved on regen, that's a separate decision that should change both the client cleanup and this new one in the same shot.

### Verification

1. Generate a multi-day trip; note `Budget` total (call it $T).
2. Regenerate day 2 once → `[persist-day] Removed N orphan activity_costs rows for day 2` appears in logs; total stays ≈ $T (within normal regen variance).
3. Regenerate day 2 three more times → total still ≈ $T, **not** ≈ 4 × T's day-2 share.
4. Check DB: `SELECT count(*) FROM activity_costs WHERE trip_id = … AND day_number = 2 AND source <> 'logistics-sync'` equals the number of priced activities currently visible on day 2.
5. Lock one activity on day 2, regenerate again → locked activity's cost row survives (its id is in `normalizedActivities` via the `uuidRows` path), unlocked cost rows are replaced.
6. Logistics rows (flight/hotel for day 2 if any): unchanged by cleanup. Verify with `SELECT count(*) … WHERE source = 'logistics-sync'` before vs after.

### Files

- `supabase/functions/generate-itinerary/pipeline/persist-day.ts` — single insert of ~25 lines after section 6.
- No schema changes, no client changes, no other edge-function changes.