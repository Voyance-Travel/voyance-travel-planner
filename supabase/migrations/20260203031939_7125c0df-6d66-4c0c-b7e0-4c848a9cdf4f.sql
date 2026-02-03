-- Update the handle_new_user function to grant 500 free credits on signup
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
  -- Extract first and last name from metadata
  raw_first_name := NEW.raw_user_meta_data->>'first_name';
  raw_last_name := NEW.raw_user_meta_data->>'last_name';
  
  -- Compute display_name: prefer "First Last", fallback to name/full_name, fallback to email username
  IF raw_first_name IS NOT NULL AND raw_last_name IS NOT NULL THEN
    computed_display_name := raw_first_name || ' ' || raw_last_name;
  ELSE
    computed_display_name := COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    );
  END IF;

  -- Insert profile
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

  -- Create default preferences
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  -- Grant 500 free credits to new users (expires in 6 months)
  INSERT INTO public.credit_balances (user_id, free_credits, purchased_credits, free_credits_expires_at)
  VALUES (NEW.id, 500, 0, now() + interval '6 months')
  ON CONFLICT (user_id) DO NOTHING;

  -- Log the signup bonus in the credit ledger
  INSERT INTO public.credit_ledger (user_id, amount, credit_type, action, description)
  VALUES (NEW.id, 500, 'free', 'signup_bonus', 'Welcome bonus - 500 free credits');

  RETURN NEW;
END;
$function$;