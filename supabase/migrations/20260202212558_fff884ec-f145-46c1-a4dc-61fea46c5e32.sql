-- Day Balances: Track user days (purchased and free)
CREATE TABLE public.day_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Purchased days (never expire)
  purchased_days INTEGER NOT NULL DEFAULT 0,
  
  -- Free days (expire after 6 months, max 5 banked)
  free_days INTEGER NOT NULL DEFAULT 0,
  free_days_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Current package tier (null = à la carte only)
  active_tier TEXT CHECK (active_tier IN ('essential', 'complete')),
  
  -- Package limits (swaps/regenerates remaining for Essential users)
  swaps_remaining INTEGER,
  regenerates_remaining INTEGER,
  
  -- Monthly free tier limits
  monthly_swaps_used INTEGER NOT NULL DEFAULT 0,
  monthly_regenerates_used INTEGER NOT NULL DEFAULT 0,
  monthly_reset_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()) + INTERVAL '1 month',
  
  -- Tracking
  last_free_day_earned_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT day_balances_user_unique UNIQUE (user_id)
);

-- Day Ledger: Immutable log of all day transactions
CREATE TABLE public.day_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'purchase',           -- Bought days
    'free_monthly',       -- Monthly free day earned
    'free_expired',       -- Free days expired
    'consumed',           -- Used a day for trip generation
    'refund',             -- Refunded purchase
    'migration'           -- Legacy credit conversion
  )),
  
  days_delta INTEGER NOT NULL,  -- Positive for additions, negative for deductions
  is_free_day BOOLEAN NOT NULL DEFAULT false,
  
  -- Purchase metadata
  stripe_session_id TEXT,
  stripe_product_id TEXT,
  price_id TEXT,
  amount_cents INTEGER,
  
  -- Package info (if applicable)
  package_tier TEXT,
  package_days INTEGER,
  
  -- Reference to trip (for consumed days)
  trip_id UUID,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.day_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies for day_balances
CREATE POLICY "Users can view their own day balance"
  ON public.day_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own day balance"
  ON public.day_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own day balance"
  ON public.day_balances FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for day_ledger (read-only for users, service role writes)
CREATE POLICY "Users can view their own ledger"
  ON public.day_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_day_balances_user_id ON public.day_balances(user_id);
CREATE INDEX idx_day_ledger_user_id ON public.day_ledger(user_id);
CREATE INDEX idx_day_ledger_stripe_session ON public.day_ledger(stripe_session_id);
CREATE INDEX idx_day_ledger_created_at ON public.day_ledger(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_day_balances_updated_at
  BEFORE UPDATE ON public.day_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();