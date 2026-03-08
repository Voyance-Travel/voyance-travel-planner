-- Drop the foreign key constraint that requires uuid type
ALTER TABLE public.guide_favorites
  DROP CONSTRAINT IF EXISTS guide_favorites_activity_id_fkey;

-- Now alter the column type to text
ALTER TABLE public.guide_favorites
  ALTER COLUMN activity_id TYPE text USING activity_id::text;