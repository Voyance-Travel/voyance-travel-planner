
-- Fix FK to point to community_guides instead of guides
ALTER TABLE public.guide_sections
  DROP CONSTRAINT guide_sections_guide_id_fkey;

ALTER TABLE public.guide_sections
  ADD CONSTRAINT guide_sections_guide_id_fkey
  FOREIGN KEY (guide_id) REFERENCES public.community_guides(id) ON DELETE CASCADE;

-- Fix RLS policy to reference community_guides
DROP POLICY IF EXISTS "Users can manage sections of own guides" ON public.guide_sections;

CREATE POLICY "Users can manage sections of own guides"
  ON public.guide_sections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_guides
      WHERE community_guides.id = guide_sections.guide_id
        AND (community_guides.user_id = auth.uid() OR community_guides.status = 'published')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_guides
      WHERE community_guides.id = guide_sections.guide_id
        AND community_guides.user_id = auth.uid()
    )
  );
