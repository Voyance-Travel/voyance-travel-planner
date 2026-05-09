## RS.5 — Balance reconciliation background job

Add an hourly pg_cron job that recomputes each user's `credit_balances` cache from `credit_purchases` (source of truth) and corrects any drift. Then run it once to backfill existing drift.

### Files

**New migration** `supabase/migrations/<timestamp>_balance_reconciliation_job.sql`:

1. `CREATE OR REPLACE FUNCTION public.reconcile_credit_balances() RETURNS jsonb` — `SECURITY DEFINER`, `search_path = public`. Iterates distinct `user_id` from `credit_purchases` where `remaining > 0`, computes:
   - `purchased_credits` = SUM(remaining) for `credit_type IN ('flex','club_base','topup','migration','manual_grant')`
   - `free_credits` = SUM(remaining) for `credit_type IN ('free_monthly','signup_bonus','referral_bonus','club_bonus','refund')`
   - filtered by `expires_at IS NULL OR expires_at > now()`
   
   Compares to cache, upserts on drift, returns `{success, total_users_checked, drift_corrected, ran_at}`.
2. `REVOKE ALL ... FROM PUBLIC, anon, authenticated;` `GRANT EXECUTE ... TO service_role;`
3. `cron.schedule('reconcile-credit-balances-hourly', '0 * * * *', $$SELECT public.reconcile_credit_balances()$$);` — guarded with `IF NOT EXISTS` check against `cron.job` to make migration re-runnable.

**Post-deploy backfill** (run via insert tool, not migration): `SELECT public.reconcile_credit_balances();`

### Notes / decisions baked in

- The original spec listed only 4 paid + 4 free credit_types. The DB CHECK constraint allows 10 types. I expanded the buckets so `topup`/`migration`/`manual_grant` count as purchased and `refund` counts as free, matching how those rows are used elsewhere in the codebase. If you want a different bucketing (e.g. exclude `refund` entirely), say so before approving.
- `pg_cron` is the standard scheduler in this project; assumed already enabled. The migration will `CREATE EXTENSION IF NOT EXISTS pg_cron;` to be safe.
- Uses `ON CONFLICT (user_id)` — `credit_balances.user_id` already has a UNIQUE constraint. ✓
- Does not touch `free_credits_expires_at` or `last_free_credit_at` (orthogonal fields managed elsewhere).
- Verification: `ls supabase/migrations/ | grep balance_reconciliation` and the manual `SELECT` returns the drift_corrected count.