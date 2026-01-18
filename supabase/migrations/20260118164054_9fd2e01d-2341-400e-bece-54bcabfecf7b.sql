-- Create a mapping table to preserve legacy user IDs from imports
CREATE TABLE IF NOT EXISTS public.user_id_mappings (
  legacy_user_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_id_mappings ENABLE ROW LEVEL SECURITY;

-- Policies: only admins can view/manage mappings from the app
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_id_mappings' AND policyname = 'Admins can view user ID mappings'
  ) THEN
    CREATE POLICY "Admins can view user ID mappings"
    ON public.user_id_mappings
    FOR SELECT
    USING (public.has_role('admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_id_mappings' AND policyname = 'Admins can insert user ID mappings'
  ) THEN
    CREATE POLICY "Admins can insert user ID mappings"
    ON public.user_id_mappings
    FOR INSERT
    WITH CHECK (public.has_role('admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_id_mappings' AND policyname = 'Admins can update user ID mappings'
  ) THEN
    CREATE POLICY "Admins can update user ID mappings"
    ON public.user_id_mappings
    FOR UPDATE
    USING (public.has_role('admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_id_mappings' AND policyname = 'Admins can delete user ID mappings'
  ) THEN
    CREATE POLICY "Admins can delete user ID mappings"
    ON public.user_id_mappings
    FOR DELETE
    USING (public.has_role('admin'));
  END IF;
END $$;

-- Timestamp trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_id_mappings_updated_at'
  ) THEN
    CREATE TRIGGER update_user_id_mappings_updated_at
    BEFORE UPDATE ON public.user_id_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_id_mappings_user_id ON public.user_id_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_id_mappings_email ON public.user_id_mappings(email);
