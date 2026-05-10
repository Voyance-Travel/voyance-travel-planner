ALTER TABLE public.curated_images
  ADD COLUMN IF NOT EXISTS user_report_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_curated_images_report_count
  ON public.curated_images (user_report_count)
  WHERE user_report_count >= 3;

CREATE TABLE IF NOT EXISTS public.image_quality_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination TEXT,
  image_url TEXT NOT NULL,
  source TEXT,
  rejected_reason TEXT,
  llm_score NUMERIC,
  basic_check_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_quality_log_created_at
  ON public.image_quality_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_quality_log_destination
  ON public.image_quality_log (destination);

ALTER TABLE public.image_quality_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read image quality log" ON public.image_quality_log;
CREATE POLICY "Admins can read image quality log"
  ON public.image_quality_log FOR SELECT
  TO authenticated
  USING (public.has_role('admin'::public.app_role));