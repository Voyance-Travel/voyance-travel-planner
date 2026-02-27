-- Create public bucket for migrated site images
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-images', 'site-images', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure public read access for site-images objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read access for site images'
  ) THEN
    CREATE POLICY "Public read access for site images"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'site-images');
  END IF;
END $$;

-- Mapping table to track Unsplash URL -> internal storage URL migration
CREATE TABLE IF NOT EXISTS public.site_image_mappings (
  photo_id text PRIMARY KEY,
  original_url text NOT NULL,
  storage_path text NOT NULL,
  storage_url text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_image_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_image_mappings'
      AND policyname = 'Authenticated users can view site image mappings'
  ) THEN
    CREATE POLICY "Authenticated users can view site image mappings"
    ON public.site_image_mappings
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'site_image_mappings_updated_at'
  ) THEN
    CREATE TRIGGER site_image_mappings_updated_at
    BEFORE UPDATE ON public.site_image_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;