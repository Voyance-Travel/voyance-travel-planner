
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

  -- Create credit_balances row with 0 credits.
  -- Set last_free_credit_at to NOW() to prevent the monthly grant from firing on signup month.
  -- The welcome bonus edge function handles the actual initial credit grant (+150).
  INSERT INTO public.credit_balances (user_id, free_credits, purchased_credits, free_credits_expires_at, last_free_credit_at)
  VALUES (NEW.id, 0, 0, now() + interval '2 months', now())
  ON CONFLICT (user_id) DO NOTHING;

  -- NO ledger entry here — the welcome bonus edge function will create one.

  RETURN NEW;
END;
$function$;
