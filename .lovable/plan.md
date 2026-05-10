## P1.3 — `pre_restore_snapshot` audit

### Findings

**Both parts of the spec are already in place, and the migration in the spec is not applicable.**

1. **Enum migration — NOT NEEDED.** The spec assumes `created_by_action` is an enum named `itinerary_version_action`. It isn't. In `public.itinerary_versions`:

   ```
   created_by_action | text |  | (nullable, no default)
   ```

   It's a plain `text` column, so no `ALTER TYPE … ADD VALUE 'pre_restore_snapshot'` is required (and running one would fail — the type does not exist). Other code already writes free-form values like `'manual_save'`, `'regenerate'`, `'swap'`, `'restored_from_v12'`, etc.

2. **Pre-restore snapshot insert — ALREADY WIRED.** `src/services/itineraryVersionHistory.ts` `restoreVersion(...)` (lines 138–225) already:
   - reads the current `is_current = true` row,
   - inserts a new row with `created_by_action: 'pre_restore_snapshot'` and `day_metadata.label = 'Pre-restore snapshot'`, `auto_snapshot: true`, `before_restore_of_version: versionNumber`,
   - aborts the restore if the snapshot insert fails (prevents data loss),
   - then inserts the restore row tagged `restored_from_v{n}`.

3. **Verify command result.** `grep -rn "pre_restore_snapshot" supabase/migrations/ src/services/` currently returns **1** match (in `src/services/itineraryVersionHistory.ts`), not ≥2, because no migration file references it — and none is required, since the column is `text`. The spec's expected count assumes the enum path.

### Plan

A. **Close P1.3 as already-shipped.** Add an audit note to `.lovable/plan.md` recording:
   - column is `text` not enum → migration skipped intentionally,
   - code path already snapshots current state before restore,
   - verify-grep expected count adjusted to ≥1 in `src/services/`.

   No code or DB changes.

B. **(Optional, only if you want it.)** Tighten `formatVersionLabel` in `itineraryVersionHistory.ts` to render `pre_restore_snapshot` as `"Pre-restore snapshot"` instead of falling through to `"Modified"`. Pure UI label, ~3 lines added to the existing `switch`.

C. **Reject — you actually want an enum.** If the intent is to lock `created_by_action` down to a known set of values, that's a larger migration (create enum, backfill all existing text values into the enum, alter column type, update every writer). I can scope that separately if you want — it's not what the spec described.

### Recommendation

**A + B.** A closes the ticket honestly; B is the only meaningful behavior change still on the table for this item, and it's cosmetic.