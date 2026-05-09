# RS.M.B2 — `canonical_cost_rows` mutex (real write path)

## Problem

The original prescription targeted `src/services/canonicalCostRows.ts` lines 136–152, but that `popRescue` cursor is a **pure in-memory, per-call** map used inside the synchronous `resolveCanonicalCostRows` resolver. Each call gets its own `cursors` Map (line 137), so concurrent callers cannot race and there's nothing to lock.

The **real race** lives one layer down — in the persistence flow that turns those resolved rows back into DB writes:

```text
Itinerary edit (EditorialItinerary or ItineraryAssistant)
        │
        ▼
syncActivitiesToCostTable(tripId, activities)   ← upsert by (trip_id, activity_id)
        │
        ▼
cleanupRemovedActivityCosts(tripId, liveIds)    ← delete rows whose activity_id no longer exists
```

When a user edits an activity, its `id` changes. The old row (which may carry `is_paid=true`, `paid_at`, `paid_amount_cents`, `paid_via_settlement`) is **deleted** by the cleanup pass and a fresh **unpaid** row is created by the upsert. Payment state is silently lost.

If two tabs / the assistant + a manual edit run concurrently, both call `sync` + `cleanup` and can each grab the same "stale candidate" row, double-rescuing or losing it entirely. There is no atomic locking today.

## Fix

Add a `SECURITY DEFINER` RPC `rescue_orphan_cost_row` that uses `FOR UPDATE SKIP LOCKED` to atomically transfer paid-state from one stale row in `(trip_id, day_number, category)` to the incoming `activity_id`. Call it from `syncActivitiesToCostTable` as a **pre-pass**, before the upsert/cleanup pair runs, only for rows whose `activity_id` is brand new (no existing `(trip_id, activity_id)` match) and where a same-(day, category) orphan exists.

## Implementation

### 1. Migration — new file under `supabase/migrations/`

```sql
CREATE OR REPLACE FUNCTION public.rescue_orphan_cost_row(
  p_trip_id uuid,
  p_day_number int,
  p_category text,
  p_new_activity_id uuid,
  p_live_activity_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id uuid;
BEGIN
  -- Lock one stale candidate in this (trip, day, category) bucket: a row
  -- whose activity_id is NOT in the live itinerary anymore and is NOT the
  -- new id we're about to insert. SKIP LOCKED ensures concurrent rescuers
  -- never grab the same target.
  SELECT id INTO v_target_id
  FROM public.activity_costs
  WHERE trip_id = p_trip_id
    AND day_number = p_day_number
    AND lower(category) = lower(p_category)
    AND source <> 'logistics-sync'
    AND activity_id <> p_new_activity_id
    AND NOT (activity_id = ANY(p_live_activity_ids))
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_candidate');
  END IF;

  -- Migrate the row onto the new activity_id, preserving paid state.
  UPDATE public.activity_costs
     SET activity_id = p_new_activity_id,
         updated_at = now()
   WHERE id = v_target_id;

  RETURN jsonb_build_object('success', true, 'rescued_row_id', v_target_id);
EXCEPTION WHEN unique_violation THEN
  -- A concurrent rescuer already migrated a row onto p_new_activity_id.
  -- That's fine — leave the stale row for the cleanup pass to delete.
  RETURN jsonb_build_object('success', false, 'reason', 'already_rescued');
END $$;

REVOKE ALL ON FUNCTION public.rescue_orphan_cost_row(uuid, int, text, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rescue_orphan_cost_row(uuid, int, text, uuid, uuid[]) TO authenticated, service_role;
```

### 2. `src/services/activityCostService.ts` — wire the rescue

In `syncActivitiesToCostTable`, before the upsert chunk loop:

1. Read existing `(activity_id, day_number, category)` triples for the trip from `activity_costs` (one query).
2. For each new row in `rows` whose `activity_id` is **not** in that set, call:
   ```ts
   await supabase.rpc('rescue_orphan_cost_row', {
     p_trip_id: tripId,
     p_day_number: row.day_number,
     p_category: row.category,
     p_new_activity_id: row.activity_id,
     p_live_activity_ids: liveActivityIds, // already known by caller
   });
   ```
   Best-effort — log on error, don't abort the sync.
3. Continue with the existing chunked upsert (which is now an idempotent no-op for rescued rows since the row already carries the new `activity_id`).

The signature gains an optional `liveActivityIds: string[]` parameter (the same set callers already pass to `cleanupRemovedActivityCosts`); both call sites in `EditorialItinerary.tsx` and `ItineraryAssistant.tsx` already compute this list a few lines above the sync call, so threading it through is mechanical.

### 3. Leave `canonicalCostRows.ts` alone

The in-memory `popRescue` cursor is correct as-is: pure, per-call, no shared state. It produces the resolved view; persistence is what needed locking. Adding a memory note that B2's "race" lives in the sync/cleanup pair, not the resolver, prevents the next agent from re-reading the original prescription and breaking the synchronous resolver.

## Verification

- `ls supabase/migrations/ | grep rescue_orphan_cost_row` → migration file present.
- `rg -n "rescue_orphan_cost_row" src/services/activityCostService.ts` → ≥ 1 (the rpc call).
- Manual: edit an activity that has `is_paid=true` in `activity_costs`; after save, the new `activity_id` row in `activity_costs` retains `is_paid`, `paid_at`, `paid_amount_cents`, `paid_via_settlement`.
- Concurrent: two simultaneous `syncActivitiesToCostTable` calls with overlapping new IDs in the same `(day, category)` bucket — only one rescue succeeds per stale row (`FOR UPDATE SKIP LOCKED`), the rest return `no_candidate` cleanly.

## Files

- **New:** `supabase/migrations/<timestamp>_rescue_orphan_cost_row.sql`
- **Edit:** `src/services/activityCostService.ts` — add rescue pre-pass + new optional param to `syncActivitiesToCostTable`
- **Edit:** `src/components/itinerary/EditorialItinerary.tsx` — pass `liveActivityIds` into `syncActivitiesToCostTable`
- **Edit:** `src/components/itinerary/ItineraryAssistant.tsx` — same
