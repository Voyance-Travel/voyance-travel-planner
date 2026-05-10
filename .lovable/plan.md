## RS.M6 — Date version restore: keep history (snapshot + mark, no destructive delete)

Today `restoreTripDateVersion(tripId)` **deletes** the popped version and every older row (lines 100–111). That destroys the audit trail. Replace with: (1) snapshot the pre-restore trip dates as a new version row, (2) leave the popped version in place, (3) mark it `restored_at` + bump `times_restored`.

### Caller-shape note (deviation from literal spec)

The user's spec uses signature `restoreTripDateVersion(versionId, tripId): Promise<void>` and updates `trips` from inside the helper. The **existing single caller** `src/pages/TripDetail.tsx` line 2086 calls it as `restoreTripDateVersion(tripId)` and **already** updates `trips` + local state from the returned `snapshot` (lines 2092–2120). Switching to the spec signature would mean either:
- changing the caller to fetch a `versionId` first (extra round-trip + UX change), or
- silently double-writing `trips` (helper updates → caller updates again).

Plan keeps the **existing public signature `(tripId)` and `{success, snapshot, error}` return shape** and applies the spec's *behavior*: pre-restore snapshot insert + non-destructive mark instead of the two `.delete()` calls. This satisfies the spec's intent (keep older versions, audit a restore) without breaking the caller. Verify grep target is met regardless.

### File: `src/services/tripDateVersionHistory.ts`

Replace lines 100–111 (the two delete calls) with:

1. **Pre-restore snapshot** — read current `trips.start_date / end_date / itinerary_data / hotel_selection`, INSERT a new `trip_date_versions` row with `created_by_action: 'pre_restore_snapshot'` (existing column) and label `'Pre-restore snapshot'` carried in a new `metadata` jsonb (column added by migration). Tolerates failure with a warn log; never aborts the restore.
2. **Mark popped version** — UPDATE the row at `version.id` setting `restored_at = now()` and `times_restored = COALESCE(times_restored, 0) + 1`. We already have `version` in scope; do the increment inline (atomic enough for an undo-stack; an RPC is overkill here).
3. **Drop both `.delete()` calls.** Older versions remain.

`TripDateVersion` interface gains `restored_at?: string | null` and `times_restored?: number | null` for type completeness; `getLastTripDateVersion` still returns the most recent row regardless of `restored_at` (matches current "stack of all versions" behavior).

### Migration: `trip_date_versions` schema additions

```sql
ALTER TABLE public.trip_date_versions
  ADD COLUMN IF NOT EXISTS restored_at  timestamptz,
  ADD COLUMN IF NOT EXISTS times_restored integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata     jsonb     NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS label        text;
```

`metadata` and `label` are added because the spec body writes both; current schema has neither (verified by reading the insert in `saveTripDateVersion` lines 39–47 — only six columns set). All four are nullable / defaulted so existing rows are unaffected. RLS is unchanged (existing policies cover the table by `trip_id`).

### Out of scope
- Changing the undo UX in `TripDetail.tsx`. The existing one-click undo continues to work; the difference is invisible to users until/unless we surface a "version history" UI later.
- Bounding `trip_date_versions` row count. RS.M5 added a global cap on `itinerary_versions` only; if `trip_date_versions` grows unbounded it can be capped in a follow-up.
- Adding a `restoreSpecificVersion(versionId)` API for non-stack restores (the spec hints at it, but no UI consumes it today).

### Verification
- `grep -c "Pre-restore snapshot\|restored_at" src/services/tripDateVersionHistory.ts` → ≥ 2 (one literal, one column read in the UPDATE; the interface field counts as a third).
- After migration, `\d public.trip_date_versions` shows `restored_at`, `times_restored`, `metadata`, `label`.
- Manual: trigger a date change → undo. `SELECT id, restored_at, times_restored, created_by_action FROM trip_date_versions WHERE trip_id = …` shows the original version with `restored_at` set + `times_restored = 1`, plus a new row with `created_by_action = 'pre_restore_snapshot'`. Older rows still present.
- Re-undo (if user redoes the same dates and undoes again): `times_restored` increments to 2.