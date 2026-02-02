-- ============================================================
-- Credit System Tables - Single Currency Model
-- ============================================================

-- Credit Balances: Current state of user's credits
CREATE TABLE public.credit_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  purchased_credits INTEGER NOT NULL DEFAULT 0,
  free_credits INTEGER NOT NULL DEFAULT 0,
  free_credits_expires_at TIMESTAMPTZ,
  last_free_credit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credit Ledger: Immutable audit trail of all credit transactions
CREATE TABLE public.credit_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  transaction_type TEXT NOT NULL, -- 'purchase', 'signup_bonus', 'monthly_free', 'referral', 'spend', 'refund', 'admin_adjustment'
  credits_delta INTEGER NOT NULL, -- positive for credits in, negative for credits out
  is_free_credit BOOLEAN NOT NULL DEFAULT false,
  action_type TEXT, -- 'unlock_day', 'swap_activity', 'regenerate_day', 'restaurant_rec', 'ai_message'
  trip_id UUID, -- linked trip if applicable
  activity_id UUID, -- linked activity if applicable
  stripe_session_id TEXT,
  stripe_product_id TEXT,
  price_id TEXT,
  amount_cents INTEGER, -- for purchases, the dollar amount paid
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_balances
CREATE POLICY "Users can view their own credit balance"
  ON public.credit_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage credit balances"
  ON public.credit_balances FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for credit_ledger
CREATE POLICY "Users can view their own credit history"
  ON public.credit_ledger FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert credit ledger entries"
  ON public.credit_ledger FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Indexes for performance
CREATE INDEX idx_credit_balances_user_id ON public.credit_balances(user_id);
CREATE INDEX idx_credit_ledger_user_id ON public.credit_ledger(user_id);
CREATE INDEX idx_credit_ledger_stripe_session ON public.credit_ledger(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX idx_credit_ledger_transaction_type ON public.credit_ledger(transaction_type);
CREATE INDEX idx_credit_ledger_created_at ON public.credit_ledger(created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_credit_balances_updated_at
  BEFORE UPDATE ON public.credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();