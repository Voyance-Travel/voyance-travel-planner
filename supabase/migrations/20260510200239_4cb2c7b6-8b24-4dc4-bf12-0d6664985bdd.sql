-- Switch views to security_invoker so they enforce the caller's permissions
ALTER VIEW public.public_customer_reviews SET (security_invoker = on);
ALTER VIEW public.public_trip_members SET (security_invoker = on);

-- =====================================================================
-- customer_reviews: column-level grant + row policy for anon
-- (anon can only read non-PII columns of approved rows)
-- =====================================================================
GRANT SELECT (id, name, rating, review_text, trip_destination, archetype,
              is_featured, photo_consent, created_at)
  ON public.customer_reviews TO anon;
GRANT SELECT (id, name, rating, review_text, trip_destination, archetype,
              is_featured, photo_consent, created_at)
  ON public.customer_reviews TO authenticated;

DROP POLICY IF EXISTS "customer_reviews_anon_approved_read" ON public.customer_reviews;
CREATE POLICY "customer_reviews_anon_approved_read" ON public.customer_reviews
FOR SELECT TO anon
USING (is_approved = true);

-- =====================================================================
-- trip_members: column-level grant + row policy for collaborators
-- (signed-in collaborators can read non-email columns; owners + self
--  retain full row access via the policies added in the prior migration)
-- =====================================================================
GRANT SELECT (id, trip_id, user_id, name, role, invited_at, accepted_at,
              created_at, updated_at)
  ON public.trip_members TO authenticated;

DROP POLICY IF EXISTS "trip_members_collab_read_nonpii" ON public.trip_members;
CREATE POLICY "trip_members_collab_read_nonpii" ON public.trip_members
FOR SELECT TO authenticated
USING (
  trip_id IN (SELECT public.get_user_trip_ids(auth.uid()))
);