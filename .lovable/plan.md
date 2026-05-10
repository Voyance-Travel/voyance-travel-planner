## RS.L8 — Hardened `cleanup_rate_limits()` with table-existence guard

The existing function (migration `20260203000820`) returns `void` and also cleans `daily_usage`. The user's hardened body only covers `rate_limits` — applying it verbatim would silently drop the `daily_usage` cleanup. The plan keeps that side effect to avoid regressing the cron.

### New migration

`supabase/migrations/<timestamp>_cleanup_rate_limits_hardened.sql`

```sql
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_rl int := 0;
  v_deleted_du int := 0;
BEGIN
  -- Defensive: check the rate_limits table exists. Without this, a rename
  -- or out-of-order migration causes the cron to silently error every run.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rate_limits'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rate_limits_table_missing');
  END IF;

  DELETE FROM public.rate_limits
  WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_deleted_rl = ROW_COUNT;

  -- Preserve existing behavior: also prune daily_usage history (>7 days).
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'daily_usage'
  ) THEN
    DELETE FROM public.daily_usage
    WHERE usage_date < CURRENT_DATE - INTERVAL '7 days';
    GET DIAGNOSTICS v_deleted_du = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_rate_limits', v_deleted_rl,
    'deleted_daily_usage', v_deleted_du,
    'ran_at', now()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END $$;
```

### Cron compatibility

The existing cron job runs `SELECT public.cleanup_rate_limits()`. Changing the return type from `void` to `jsonb` does NOT require re-scheduling — `SELECT` of a function that returns `jsonb` works fine; the result is just discarded by cron. No `cron.unschedule` / `cron.schedule` needed.

### Verification

- `grep -c "rate_limits_table_missing\|GET DIAGNOSTICS v_deleted" supabase/migrations/*.sql` ≥ 1
- Manual: invoke `SELECT public.cleanup_rate_limits();` — expect `{"success": true, "deleted_rate_limits": N, ...}`. If `rate_limits` is dropped, expect `{"success": false, "reason": "rate_limits_table_missing"}` instead of an exception.

### Out of scope

- Changing the cron schedule
- Adding observability (e.g. logging into a maintenance table)
- Touching `daily_usage` retention policy
