-- C-COST-3b: Google daily ceiling never enforced — public.google_api_budget
-- stays empty even though ~1,400 live Google calls were cost-tracked.
--
-- Root cause (NOT logic): consume_google_budget() is correct and works when
-- called directly over SQL (confirmed: returns the running count, writes a row).
-- The edge wrappers in _shared/google-api.ts DO call it before every Google SKU
-- (consumeGoogleBudget → client.rpc('consume_google_budget', {p_cost, p_limit})),
-- but that call goes through PostgREST, and PostgREST's schema cache never
-- actually exposed the function — so the RPC 404'd, the wrapper FAILED OPEN by
-- design (google-api.ts:103-105), the Google call proceeded, trip_cost_tracking
-- got the cost row, and the budget row was never written. The original
-- migration's `NOTIFY pgrst, 'reload schema'` was evidently missed during deploy.
--
-- Fix: re-create the function IDENTICALLY. The CREATE OR REPLACE fires a fresh
-- DDL event, which (together with the explicit NOTIFY) forces PostgREST to
-- reload its schema cache and finally expose the RPC over REST. No behavior
-- change — this is byte-for-byte the body from 20260605135409. Also removes the
-- one manual verification row so the dashboard doesn't show a phantom spend.
--
-- After applying: redeploy the edge functions is NOT required (their code is
-- already correct) — but a redeploy is harmless and guarantees the latest
-- google-api.ts is live. The budget table will start accumulating on the next
-- generation that touches Google.

CREATE OR REPLACE FUNCTION public.consume_google_budget(
  p_cost  numeric DEFAULT 0,
  p_limit integer DEFAULT 200
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.google_api_budget (day, call_count, cost_usd)
  VALUES (CURRENT_DATE, 1, p_cost)
  ON CONFLICT (day) DO UPDATE
    SET call_count = public.google_api_budget.call_count + 1,
        cost_usd   = public.google_api_budget.cost_usd + p_cost,
        updated_at = now()
    WHERE public.google_api_budget.call_count < p_limit
  RETURNING call_count INTO v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_google_budget(numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_google_budget(numeric, integer) TO service_role;

-- Remove the manual verification row (targeted signature so it can NEVER touch
-- real accumulated data: real traffic would push call_count > 1 / cost > 0.032).
DELETE FROM public.google_api_budget
  WHERE call_count = 1 AND cost_usd = 0.032;

NOTIFY pgrst, 'reload schema';
