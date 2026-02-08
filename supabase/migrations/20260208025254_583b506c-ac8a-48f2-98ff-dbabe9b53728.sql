
-- ============================================================
-- Free Tier Status — Separate Table (replaces credit_balances columns)
-- ============================================================

-- 1. Create dedicated free tier tracking table
CREATE TABLE public.free_tier_status (
  user_id uuid NOT NULL PRIMARY KEY,
  free_trip_used boolean NOT NULL DEFAULT false,
  free_edits_remaining integer NOT NULL DEFAULT 5,
  free_trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.free_tier_status ENABLE ROW LEVEL SECURITY;

-- 3. Users can only read their own status
CREATE POLICY "Users can view own free tier status"
  ON public.free_tier_status FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Users can insert their own row (on first trip)
CREATE POLICY "Users can insert own free tier status"
  ON public.free_tier_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Users can update their own row
CREATE POLICY "Users can update own free tier status"
  ON public.free_tier_status FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. Auto-create free_tier_status on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_free_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.free_tier_status (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach to auth.users insertions (fires after existing profile triggers)
CREATE TRIGGER on_auth_user_created_free_tier
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_free_tier();

-- 7. Replace increment function to use new table
CREATE OR REPLACE FUNCTION public.consume_free_edit(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining integer;
BEGIN
  UPDATE free_tier_status
  SET free_edits_remaining = GREATEST(0, free_edits_remaining - 1),
      updated_at = now()
  WHERE user_id = p_user_id
    AND free_edits_remaining > 0
  RETURNING free_edits_remaining INTO v_remaining;

  IF NOT FOUND THEN
    -- Either no row or already at 0
    SELECT free_edits_remaining INTO v_remaining
    FROM free_tier_status WHERE user_id = p_user_id;
    
    IF v_remaining IS NULL THEN
      RAISE EXCEPTION 'No free tier status found for user';
    END IF;
    
    RETURN jsonb_build_object(
      'success', false,
      'edits_remaining', 0,
      'limit_reached', true
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'edits_remaining', v_remaining,
    'limit_reached', v_remaining <= 0
  );
END;
$$;

-- 8. Drop old columns from credit_balances (cleanup)
ALTER TABLE public.credit_balances
  DROP COLUMN IF EXISTS free_trip_claimed,
  DROP COLUMN IF EXISTS free_edits_used,
  DROP COLUMN IF EXISTS free_edits_limit;

-- 9. Drop old function
DROP FUNCTION IF EXISTS public.increment_free_edits(uuid);

-- 10. Seed existing users with free_tier_status rows
INSERT INTO public.free_tier_status (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 11. Updated_at trigger
CREATE TRIGGER update_free_tier_status_updated_at
  BEFORE UPDATE ON public.free_tier_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
