## TRIP-1 — Restore version pre-snapshot (adapted to actual schema)

### Mismatch with spec
The spec assumes whole-trip restore writing `trips.itinerary_data` and a wider `itinerary_versions` schema (`itinerary_data`, `label`, `metadata`). The actual function is per-day and does not mutate `trips`:

- Signature: `restoreVersion(tripId, dayNumber, versionNumber)` returning `{success, activities, metadata}`.
- Table columns: `activities` (jsonb), `day_metadata` (jsonb), `version_number`, `created_by_action`, `is_current`. No `label` / `itinerary_data` / `metadata` jsonb.
- Callers: `useVersionHistory.ts:122` and `undoLastChange` (line 206 inside the same file).

Per user choice, keep schema/signature; adapt the spec's intent (snapshot current state before restore).

### Plan

Edit `src/services/itineraryVersionHistory.ts` `restoreVersion` (lines 138–185):

1. **Step 1 — Fetch the version to restore** (unchanged).
2. **Step 1.5 — Pre-restore snapshot of CURRENT day state.**
   - Read the current `is_current=true` row for `(trip_id, day_number)` from `itinerary_versions` (this is the live state per the existing data model).
   - If found, `INSERT` a new `itinerary_versions` row with:
     - `activities` = current row's `activities`
     - `day_metadata` = a merged object: `{ ...current.day_metadata, label: 'Pre-restore snapshot', auto_snapshot: true, before_restore_of_version: versionNumber }`
     - `created_by_action` = `'pre_restore_snapshot'`
   - If snapshot insert fails → log `[restoreVersion] Pre-restore snapshot failed — aborting restore` and return `{success:false, error: 'Could not snapshot current state — restore aborted to prevent data loss.'}`. Do NOT proceed.
   - If no current row exists (fresh trip), skip snapshot silently — there is nothing to lose.
3. **Step 2 — Apply the restore** by inserting the restored version row (existing behavior, with `created_by_action: 'restored_from_v${versionNumber}'`). The existing `BEFORE INSERT` trigger handles `version_number`/`is_current` flipping.
4. **Step 3 — Return** `{success, activities, metadata}` as today; caller applies activities to UI/trip.
5. Final `console.log('[restoreVersion] Restored', versionNumber, 'with pre-snapshot saved')`.

No callers change. No migration needed — `day_metadata` is already jsonb so `label`/`auto_snapshot` flags slot in.

### Out of scope
- Whole-trip restore semantics (would require schema migration + caller refactor).
- Changing `undoLastChange` behavior (it already routes through `restoreVersion`, so it inherits the snapshot for free).

### Verification
- `grep -c "Pre-restore snapshot\|auto_snapshot" src/services/itineraryVersionHistory.ts` ≥ 2.
- TypeScript builds; both call sites still compile.
- Manual: edit a day → restore an older version → check `itinerary_versions` for both a `pre_restore_snapshot` row (with `day_metadata.auto_snapshot=true`, `day_metadata.label='Pre-restore snapshot'`) and the `restored_from_vN` row.