
-- Revert view back to security invoker (no SECURITY DEFINER views)
ALTER VIEW public.public_customer_reviews SET (security_invoker = true);

-- Recreate a row-scoped anon SELECT policy on the base table, but use column-level
-- grants so anon literally cannot read email/user_id columns from PostgREST.
CREATE POLICY "Anon can read approved reviews (column-restricted)"
  ON public.customer_reviews
  FOR SELECT
  TO anon
  USING (is_approved = true);

-- Remove blanket SELECT, then re-grant ONLY non-PII columns to anon.
REVOKE SELECT ON public.customer_reviews FROM anon;
GRANT SELECT
  (id, name, rating, review_text, trip_destination, archetype,
   is_featured, is_approved, photo_consent, created_at, updated_at)
  ON public.customer_reviews TO anon;
-- Note: email and user_id are intentionally NOT granted to anon.

-- Authenticated keeps full SELECT (RLS already restricts rows to owner).
GRANT SELECT ON public.customer_reviews TO authenticated;

GRANT SELECT ON public.public_customer_reviews TO anon, authenticated;
