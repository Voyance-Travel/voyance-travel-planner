-- C-COST-3a (TRUE root cause): admin Unit Economics dashboard showed MONEY OUT $0.
--
-- The dashboard calls get_unit_economics_summary() via PostgREST as the `authenticated`
-- role. That role was never granted EXECUTE on the function, and this database revokes
-- the default PUBLIC execute (no migration ever granted it). So Postgres rejected the
-- call with `permission denied for function get_unit_economics_summary` BEFORE the
-- function body — and its admin guard — ever ran. The old frontend swallowed that error
-- and rendered a misleading $0 (now surfaced as a warning by PR #58).
--
-- Proof this is the cause, not the guard:
--   * A JWT-simulated call run as the function owner returned total_cost_usd = 205.07.
--   * pg_get_functiondef confirms the new has_role('admin') guard is the live body.
--   * The error string is "permission denied for function", not "Admin access required".
--
-- Fix: grant EXECUTE to `authenticated`. This is SAFE — the function's internal
-- has_role('admin') guard still enforces admin-only access, so a non-admin authenticated
-- caller simply gets 'Admin access required'. Admins get the real aggregation.

GRANT EXECUTE ON FUNCTION public.get_unit_economics_summary(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
