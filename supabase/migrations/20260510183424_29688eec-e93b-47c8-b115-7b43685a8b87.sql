ALTER TABLE public.iap_transactions
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS credits_granted integer,
  ADD COLUMN IF NOT EXISTS raw_receipt jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='iap_transactions'
      AND policyname='iap_transactions_owner_read'
  ) THEN
    EXECUTE 'CREATE POLICY "iap_transactions_owner_read" ON public.iap_transactions FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.iap_transactions FROM authenticated, anon;