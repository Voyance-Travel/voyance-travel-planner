-- Update handle_new_user function to populate first_name, last_name, and email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Insert profile with all fields
  INSERT INTO public.profiles (id, email, first_name, last_name, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    raw_first_name,
    raw_last_name,
    computed_display_name,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
        display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);

  -- Also create default preferences
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;