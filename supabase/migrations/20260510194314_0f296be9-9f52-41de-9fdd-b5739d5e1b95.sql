
-- 1. Drop the misleadingly-named row-only policy that exposed email to anon
DROP POLICY IF EXISTS "Approved reviews readable (non-PII columns)" ON public.customer_reviews;

-- 2. Revoke direct SELECT on the base table from anon (authenticated keeps it; RLS scopes to owner)
REVOKE SELECT ON public.customer_reviews FROM anon;

-- 3. Switch the public view to SECURITY DEFINER so anon can read it
--    without needing direct grants on the underlying table.
ALTER VIEW public.public_customer_reviews SET (security_invoker = false);

-- 4. Ensure view grants are in place
GRANT SELECT ON public.public_customer_reviews TO anon, authenticated;

-- 5. (Defense in depth) Explicit deny-write policies for anon on the base table
--    INSERT policy already restricts to authenticated; no anon writes possible.
