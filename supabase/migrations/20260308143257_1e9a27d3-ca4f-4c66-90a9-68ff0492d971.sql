
-- Guide reports table for community guide flagging
CREATE TABLE public.guide_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES public.community_guides(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert a report
CREATE POLICY "Anyone can report a guide"
  ON public.guide_reports FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Only admins can read reports
CREATE POLICY "Admins can read reports"
  ON public.guide_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
