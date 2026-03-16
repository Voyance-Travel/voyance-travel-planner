
CREATE POLICY "Admins can manage curated images"
ON public.curated_images FOR ALL
TO authenticated
USING (public.has_role('admin'::public.app_role))
WITH CHECK (public.has_role('admin'::public.app_role));
