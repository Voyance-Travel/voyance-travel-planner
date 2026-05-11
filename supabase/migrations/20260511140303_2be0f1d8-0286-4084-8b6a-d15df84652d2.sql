REVOKE SELECT, INSERT, UPDATE, DELETE ON public.customer_review_contacts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.customer_review_contacts FROM PUBLIC;
GRANT SELECT, INSERT ON public.customer_review_contacts TO authenticated;