-- Founding Member counter: track Adventurer purchases for the 1,000 badge cap
CREATE TABLE public.founding_member_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  purchase_number INT NOT NULL,
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  stripe_session_id TEXT
);

-- Enable RLS
ALTER TABLE public.founding_member_tracker ENABLE ROW LEVEL SECURITY;

-- Anyone can read (for showing counter)
CREATE POLICY "Founding member tracker is publicly readable"
  ON public.founding_member_tracker
  FOR SELECT
  USING (true);

-- Only server (service role) inserts — no user inserts
-- No INSERT/UPDATE/DELETE policies for anon/authenticated

-- Create a function to get the current founding member count
CREATE OR REPLACE FUNCTION public.get_founding_member_count()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::INT, 0) FROM public.founding_member_tracker;
$$;

-- Create a function to award founding member badge (called from edge function)
CREATE OR REPLACE FUNCTION public.award_founding_member(p_user_id UUID, p_stripe_session_id TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INT;
  v_purchase_number INT;
BEGIN
  -- Get current count
  SELECT COUNT(*)::INT INTO v_current_count FROM public.founding_member_tracker;
  
  -- Check if already awarded
  IF EXISTS (SELECT 1 FROM public.founding_member_tracker WHERE user_id = p_user_id) THEN
    RETURN json_build_object('awarded', false, 'reason', 'already_awarded', 'count', v_current_count);
  END IF;
  
  -- Check if cap reached
  IF v_current_count >= 1000 THEN
    RETURN json_build_object('awarded', false, 'reason', 'cap_reached', 'count', v_current_count);
  END IF;
  
  -- Award the badge
  v_purchase_number := v_current_count + 1;
  INSERT INTO public.founding_member_tracker (user_id, purchase_number, stripe_session_id)
  VALUES (p_user_id, v_purchase_number, p_stripe_session_id);
  
  RETURN json_build_object('awarded', true, 'purchase_number', v_purchase_number, 'count', v_purchase_number);
END;
$$;