
-- ============================================================
-- Free 3-Day Full Power Model
-- ============================================================

-- 1. Add free tier tracking to credit_balances
ALTER TABLE public.credit_balances
  ADD COLUMN IF NOT EXISTS free_trip_claimed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_edits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_edits_limit integer NOT NULL DEFAULT 5;

-- 2. Add free tier flag to trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS is_free_tier_trip boolean NOT NULL DEFAULT false;

-- 3. Create index for quick free-tier lookups
CREATE INDEX IF NOT EXISTS idx_trips_free_tier ON public.trips (user_id, is_free_tier_trip) WHERE is_free_tier_trip = true;

-- 4. Create a function to increment free edits atomically
CREATE OR REPLACE FUNCTION public.increment_free_edits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_used integer;
  v_limit integer;
BEGIN
  UPDATE credit_balances
  SET free_edits_used = free_edits_used + 1,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING free_edits_used, free_edits_limit
  INTO v_used, v_limit;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No credit balance found for user %', p_user_id;
  END IF;

  v_result := jsonb_build_object(
    'edits_used', v_used,
    'edits_limit', v_limit,
    'edits_remaining', GREATEST(0, v_limit - v_used),
    'limit_reached', v_used >= v_limit
  );

  RETURN v_result;
END;
$$;

-- 5. Grant existing users free_trip_claimed = false (they can claim one)
-- This is a no-op since the default is false, but explicit for clarity.

-- 6. RLS: The existing credit_balances and trips RLS policies already
-- restrict access to the owning user, so the new columns are automatically protected.
