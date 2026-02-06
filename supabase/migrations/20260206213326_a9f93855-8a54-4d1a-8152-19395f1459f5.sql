-- Create trip_complexity table for tracking pricing tier per trip
CREATE TABLE public.trip_complexity (
  trip_id UUID PRIMARY KEY REFERENCES public.trips(id) ON DELETE CASCADE,
  factor_count INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard', 'custom', 'highly_curated')),
  multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_credits INTEGER NOT NULL DEFAULT 0,
  multi_city_fee INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_complexity ENABLE ROW LEVEL SECURITY;

-- Users can read their own trip complexity
CREATE POLICY "Users can read own trip complexity"
  ON public.trip_complexity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_complexity.trip_id
      AND t.user_id = auth.uid()
    )
  );

-- Service role can insert/update (edge functions)
CREATE POLICY "Service role can manage trip complexity"
  ON public.trip_complexity
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Update handle_new_user() to grant 150 credits (was 500) with 2-month expiry
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  raw_first_name text;
  raw_last_name text;
  computed_display_name text;
BEGIN
  raw_first_name := NEW.raw_user_meta_data->>'first_name';
  raw_last_name := NEW.raw_user_meta_data->>'last_name';
  
  IF raw_first_name IS NOT NULL AND raw_last_name IS NOT NULL THEN
    computed_display_name := raw_first_name || ' ' || raw_last_name;
  ELSE
    computed_display_name := COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    );
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, display_name, avatar_url)
  VALUES (
    NEW.id,
    raw_first_name,
    raw_last_name,
    computed_display_name,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
    SET first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
        display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.travel_dna_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  -- Grant 150 free credits (was 500), expires in 2 months (was 6)
  INSERT INTO public.credit_balances (user_id, free_credits, purchased_credits, free_credits_expires_at)
  VALUES (NEW.id, 150, 0, now() + interval '2 months')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_ledger (user_id, credits_delta, is_free_credit, action_type, transaction_type, notes)
  VALUES (NEW.id, 150, true, 'signup_bonus', 'credit', 'Welcome bonus - 150 free credits');

  RETURN NEW;
END;
$function$;
