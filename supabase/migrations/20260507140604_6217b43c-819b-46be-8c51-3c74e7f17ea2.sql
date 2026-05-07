CREATE INDEX IF NOT EXISTS idx_curated_images_dest_place
  ON public.curated_images (destination, place_id)
  WHERE place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_curated_images_dest_updated
  ON public.curated_images (destination, entity_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_curated_images_alt_text_lower
  ON public.curated_images (lower(alt_text));