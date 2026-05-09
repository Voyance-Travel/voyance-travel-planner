-- Defense-in-depth RLS. RESTRICTIVE policies AND with permissive ones,
-- so `false` hard-blocks the role. service_role bypasses RLS.

CREATE POLICY "credit_purchases: deny authenticated INSERT"
  ON public.credit_purchases AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "credit_purchases: deny authenticated UPDATE"
  ON public.credit_purchases AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "credit_purchases: deny authenticated DELETE"
  ON public.credit_purchases AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "credit_purchases: deny anon all"
  ON public.credit_purchases AS RESTRICTIVE
  FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "group_unlocks: deny authenticated UPDATE"
  ON public.group_unlocks AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "group_unlocks: deny authenticated DELETE"
  ON public.group_unlocks AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "group_unlocks: deny anon all"
  ON public.group_unlocks AS RESTRICTIVE
  FOR ALL TO anon
  USING (false) WITH CHECK (false);