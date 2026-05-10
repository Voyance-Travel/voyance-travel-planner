## RS.M5 — Global per-trip version-history prune

Adds a daily-scheduled, global cap of **30 versions per trip** on `public.itinerary_versions`, on top of the existing per-(trip, day) cap of 10 enforced by the `trg_cleanup_old_itinerary_versions` trigger. Long, heavily-edited multi-week trips can currently hold 10 × N days × M edits worth of history; this bounds total trip rows.

### Inspection findings
- `public.itinerary_versions` exists; columns include `trip_id`, `day_number`, `version_number`, `is_current`, `created_at`. RLS owner-scoped.
- Existing `cleanup_old_itinerary_versions()` AFTER-INSERT trigger keeps the 10 newest per `(trip_id, day_number)` by `version_number DESC`. No global cap.
- `pg_cron` and `pg_net` extensions are both already installed. No URL/anon-key needed for this job (pure SQL call), so it ships in a migration safely.

### Migration: `supabase/migrations/<ts>_version_history_global_prune.sql`

1. **`public.prune_itinerary_versions_per_trip()`** — `SECURITY DEFINER`, `search_path = public`, returns `jsonb`. Uses a CTE with `row_number() OVER (PARTITION BY trip_id ORDER BY created_at DESC)` and deletes rows where `rn > 30`. Exposes `{pruned, ran_at}`.
2. **Safety addition** (small deviation from the literal spec): exclude `is_current = true` rows from deletion. Two reasons: a) the `idx_itinerary_versions_current` index implies callers rely on at least one current row per `(trip_id, day_number)`; b) on a 30-day trip with frequent edits, an unlucky created_at ordering could otherwise prune a current row. Final predicate: `rn > 30 AND COALESCE(is_current, false) = false`.
3. Permissions: `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO service_role;`
4. Schedule: `cron.schedule('prune-itinerary-versions-daily', '0 3 * * *', $$SELECT public.prune_itinerary_versions_per_trip()$$);` — guarded with a pre-check that unschedules any prior job of the same name so re-running the migration is idempotent.

### Out of scope
- Touching the existing per-day trigger (`cleanup_old_itinerary_versions` / `trg_cleanup_old_itinerary_versions`) — keep both layers.
- Backfill prune of rows already in the table — the first cron run will handle it.
- Surfacing run results in app UI.

### Verification
- `ls supabase/migrations/ | grep version_history_global_prune` returns the new file.
- After approval: `supabase.read_query` `SELECT proname FROM pg_proc WHERE proname='prune_itinerary_versions_per_trip'` → 1 row.
- Manual smoke (optional): seed >30 rows for one `trip_id`, call `SELECT public.prune_itinerary_versions_per_trip();`, expect remaining count = 30 (plus any preserved `is_current`).