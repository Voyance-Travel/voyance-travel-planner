CREATE TABLE IF NOT EXISTS public.iap_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  transaction_id text UNIQUE NOT NULL,
  product_id text NOT NULL,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.iap_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own IAP transactions"
  ON public.iap_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert IAP transactions"
  ON public.iap_transactions FOR INSERT
  WITH CHECK (true);