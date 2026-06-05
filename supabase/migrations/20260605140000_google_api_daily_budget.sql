-- C-COST-2 (Phase 1): hard GLOBAL daily ceiling + circuit breaker for Google API.
--
-- There was NO cap on Google calls anywhere — spend scaled linearly and
-- unboundedly with traffic (~$5/trip × N trips). This adds a single per-day
-- counter and an atomic "consume one call slot" RPC. The wrapper
-- (_shared/google-api.ts) calls it immediately before every LIVE Google fetch
-- (cache hits never reach the wrapper, so they never consume budget). When the
-- ceiling is hit, the wrapper degrades (returns a no-result) instead of calling
-- Google — bounding worst-case spend at ~ceiling × per-call price, regardless of
-- how much traffic hits the site.

CREATE TABLE IF NOT EXISTS public.google_api_budget (
  day          date PRIMARY KEY DEFAULT CURRENT_DATE,
  call_count   integer NOT NULL DEFAULT 0,
  cost_usd     numeric NOT NULL DEFAULT 0,
  breaker_open boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_api_budget ENABLE ROW LEVEL SECURITY;

-- Admins may read the budget (for the cost dashboard). No client writes — the
-- RPC is SECURITY DEFINER and runs as owner; the table is service-role-only.
DROP POLICY IF EXISTS "Admins can read google budget" ON public.google_api_budget;
CREATE POLICY "Admins can read google budget"
  ON public.google_api_budget FOR SELECT TO authenticated
  USING (public.has_role('admin'));

-- Atomically consume one Google-API call slot for today.
-- Returns the new call_count if within p_limit (caller proceeds), or NULL if the
-- ceiling is already reached (caller must NOT call Google). Single-statement
-- upsert with a conditional DO UPDATE → race-safe under concurrent edge
-- invocations (the counter only advances while under the limit, so it reflects
-- actual allowed Google calls, not blocked attempts).
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
  RETURN v_count;  -- NULL when today's row exists and is already at/over p_limit
END;
$$;

REVOKE ALL ON FUNCTION public.consume_google_budget(numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_google_budget(numeric, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
