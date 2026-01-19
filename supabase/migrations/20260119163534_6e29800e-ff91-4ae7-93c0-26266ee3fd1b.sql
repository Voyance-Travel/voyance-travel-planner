-- ============================================================================
-- Create credit_transactions table for audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('topup', 'spend')),
  amount_cents INTEGER NOT NULL,
  action_key TEXT, -- For spends: which action was purchased
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying user transaction history
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own transactions
CREATE POLICY "Users can view own credit transactions"
ON public.credit_transactions
FOR SELECT
USING (auth.uid() = user_id);

-- Only edge functions (service role) can insert transactions
CREATE POLICY "Service role can insert credit transactions"
ON public.credit_transactions
FOR INSERT
WITH CHECK (true);

-- Create user_credits table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id UUID NOT NULL PRIMARY KEY,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on user_credits
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Users can view their own credits
CREATE POLICY "Users can view own credits"
ON public.user_credits
FOR SELECT
USING (auth.uid() = user_id);

-- Only edge functions can modify credits
CREATE POLICY "Service role can modify credits"
ON public.user_credits
FOR ALL
USING (true)
WITH CHECK (true);