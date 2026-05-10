-- 1. Drop overly broad public SELECT policy that exposed email
DROP POLICY IF EXISTS "Approved reviews are publicly visible" ON public.customer_reviews;

-- 2. Revoke direct column access to PII for anon/authenticated
REVOKE SELECT (email, user_id) ON public.customer_reviews FROM anon;
REVOKE SELECT (email, user_id) ON public.customer_reviews FROM authenticated;

-- 3. Allow approved-row reads (needed for the view under security_invoker)
CREATE POLICY "Approved reviews readable (non-PII columns)"
  ON public.customer_reviews
  FOR SELECT
  TO anon, authenticated
  USING (is_approved = true);

-- 4. Sanitized public view — no email, masked name
CREATE OR REPLACE VIEW public.public_customer_reviews
WITH (security_invoker = true) AS
SELECT
  id,
  CASE
    WHEN name IS NULL OR length(btrim(name)) = 0 THEN 'Anonymous'
    ELSE substring(btrim(name) FROM 1 FOR 1) || '***'
  END AS reviewer_display,
  rating,
  review_text,
  trip_destination,
  archetype,
  is_featured,
  photo_consent,
  created_at
FROM public.customer_reviews
WHERE is_approved = true;

GRANT SELECT ON public.public_customer_reviews TO anon, authenticated;