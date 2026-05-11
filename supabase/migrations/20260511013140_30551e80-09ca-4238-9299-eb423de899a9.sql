-- R1-redo: Close customer_reviews PII leak via base table
-- Prior fix added public_customer_reviews view (PII-free) but left an anon SELECT
-- policy on the base table, which exposed the `email` column to unauthenticated
-- callers querying customer_reviews directly. Drop that policy and revoke direct
-- table access so anon must go through the view.

DROP POLICY IF EXISTS "customer_reviews_anon_approved_read" ON public.customer_reviews;

REVOKE SELECT ON public.customer_reviews FROM anon;
REVOKE SELECT ON public.customer_reviews FROM PUBLIC;