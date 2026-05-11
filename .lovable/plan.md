# Document trip-memories bucket as insert-once-delete-only (Case A)

## Audit result

`grep` for UPDATE/upsert/`upsert: true`/replace on `trip-memories` → **0 matches**.

All current bucket interactions:
- `supabase/functions/upload-trip-memory/index.ts` — service-role `.upload()` (line 154/197) and rollback `.remove()` (line 190).
- `src/services/tripMemoriesAPI.ts` — list/sign URLs (line 91/100) and `.remove()` (line 130).

No UI copy or service code performs in-place file replacement. The "replace a memory" UX, if it ever ships, would naturally route through the existing `upload-trip-memory` edge function (which generates a new path) plus a delete of the old row — not an UPDATE on `storage.objects`.

→ **Case A**: missing UPDATE policy is intentional. No code change needed; only documentation.

## Changes

1. **Migration** — attach a contract comment to the bucket row so DBAs/maintainers see the intent at the schema layer:
   ```sql
   COMMENT ON COLUMN storage.buckets.id IS NULL; -- (no-op safety: don't touch shared comment)
   -- Use a dedicated marker row in a small notes table is overkill; instead annotate via
   -- a comment on the bucket via PERFORM set_config or skip if storage schema is restricted.
   ```
   Storage-schema instructions forbid mutating `storage` tables/functions. So instead of a Postgres comment on a storage object, we record the contract via:
   - a memory entry (below), and
   - a leading header comment block in a new migration file `…_document_trip_memories_no_update.sql` containing only an explanatory `-- doc:` block (no DDL). This guarantees the contract is grep-able from `supabase/migrations/` and survives forks.

2. **Memory** — create `mem://constraints/security/storage-buckets-update-policy`:
   > `trip-memories` bucket is **insert-once + delete-only** by design. The missing UPDATE policy on `storage.objects` for this bucket is intentional. Memory replacement MUST be implemented as DELETE-then-INSERT through `upload-trip-memory` edge function (service-role, validates user/trip ownership), never as `.update()` or `{ upsert: true }`. If a future feature needs in-place replacement, add an UPDATE policy mirroring the existing INSERT/DELETE owner-folder check, and document it here. Linter warning `trip_memories_storage_no_update` is accepted-class.

   Also add a one-liner to `mem://index.md` under `## Memories`.

## Verification

1. The supabase linter `trip_memories_storage_no_update` warning is now defensibly accepted-class (no policy change, but documented intent).
2. Manual: `rg -n "from\\(['\"]trip-memories['\"]\\)" src/ supabase/` shows no `.update(` or `upsert: true` callers — re-run periodically.
3. The new migration file's `-- doc:` block is visible via `git log --grep` and `rg "trip-memories" supabase/migrations/`.

## Files

- `supabase/migrations/<timestamp>_document_trip_memories_no_update.sql` (comment-only — no DDL)
- `mem://constraints/security/storage-buckets-update-policy` (new)
- `mem://index.md` (one-line append)

## Out of scope

- No code changes to `tripMemoriesAPI.ts` or `upload-trip-memory`.
- No `storage.objects` policy added or modified.
- The other 3 bucket warnings (`agency_documents` ownership join, etc.) are tracked separately.
