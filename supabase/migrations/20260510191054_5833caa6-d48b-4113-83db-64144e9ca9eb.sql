DROP POLICY IF EXISTS "Founding member tracker is publicly readable" ON public.founding_member_tracker;

CREATE POLICY "Users can view own founding member row"
  ON public.founding_member_tracker FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all founding member rows"
  ON public.founding_member_tracker FOR SELECT TO authenticated
  USING (public.has_role('admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can read social links" ON public.user_social_links;

CREATE POLICY "Public can read social links for published creators"
  ON public.user_social_links FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_guides cg
      WHERE cg.user_id = user_social_links.user_id
        AND (cg.status = 'published' OR cg.published_at IS NOT NULL)
    )
  );
