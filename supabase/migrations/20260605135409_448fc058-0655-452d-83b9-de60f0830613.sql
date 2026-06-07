-- ============================================================================
-- Migration 1: 20260605130000_friend_outgoing_pending_visibility.sql
-- C-FRIEND-1: restore outgoing-pending profile visibility
-- ============================================================================

-- Idempotency guard: this consolidated migration re-runs the policy from
-- 20260605130000, which fails on a fresh replay ("already exists"). Drop first.
DROP POLICY IF EXISTS "Users can view profiles of outgoing pending requests" ON public.profiles;
CREATE POLICY "Users can view profiles of outgoing pending requests"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.requester_id = auth.uid()
      AND f.addressee_id = profiles.id
      AND f.status = 'pending'
  )
);

-- ============================================================================
-- Migration 2: 20260605140000_google_api_daily_budget.sql
-- C-COST-2 (Phase 1): hard GLOBAL daily ceiling + circuit breaker for Google API
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_api_budget (
  day          date PRIMARY KEY DEFAULT CURRENT_DATE,
  call_count   integer NOT NULL DEFAULT 0,
  cost_usd     numeric NOT NULL DEFAULT 0,
  breaker_open boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.google_api_budget TO service_role;

ALTER TABLE public.google_api_budget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read google budget" ON public.google_api_budget;
CREATE POLICY "Admins can read google budget"
  ON public.google_api_budget FOR SELECT TO authenticated
  USING (public.has_role('admin'));

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

NOTIFY pgrst, 'reload schema';