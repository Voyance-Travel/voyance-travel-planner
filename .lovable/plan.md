## V3 — Grep-discoverable marker migration for trip-memories no-update constraint

The original documentation migration (`20260511133529_f55e5774-…`) is on disk but its hash filename + `name` column make it invisible to `grep -i "trip_memories"` in `supabase/migrations/`. Lovable's workflow auto-generates hash-style filenames, so Option A (rename on disk + UPDATE `schema_migrations`) would fight the tooling on the next deploy. **Going with Option B.**

### Migration (no-op marker)

A new migration whose filename and SQL body both surface the constraint to `grep`/`rg`. Body is a single `SELECT` literal — no DDL, no side effects, idempotent on every push.

```sql
-- doc: trip-memories bucket is insert-once + delete-only by design.
-- Memory replacement MUST be implemented as DELETE-then-INSERT through
-- the upload-trip-memory edge function — never .update() or { upsert: true }.
-- See mem://constraints/security/storage-buckets-update-policy
-- Original documentation migration: 20260511133529_f55e5774-3c4c-4c3f-b923-3e6469dabb18
-- This file exists purely for grep-discoverability of the constraint.

SELECT 'trip_memories_no_update_documented'::text AS marker;
```

The Lovable migration tool will assign its own timestamp + hash filename. To make the *filename* grep-able too, the SQL body's leading comment block carries the discoverable tokens (`trip_memories`, `no_update`); the marker SELECT also surfaces them in `schema_migrations.name`-equivalent listings via `pg_stat_statements` if ever needed.

### Verification

```bash
rg -n "trip_memories|no_update" supabase/migrations/
# expect at least the new marker file
```

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE name ILIKE '%trip_memories%' OR name ILIKE '%no_update%';
-- expect ≥1 row (the new marker)
```

### Out of scope

- No rename of the original `20260511133529_f55e5774-…` file (would desync the migrations table).
- No direct UPDATE on `supabase_migrations.schema_migrations`.
- No code, RLS, or memory edits — `mem://constraints/security/storage-buckets-update-policy` already documents the rule and the re-audit grep.