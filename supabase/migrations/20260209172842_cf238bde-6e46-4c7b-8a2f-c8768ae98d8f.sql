
-- Phase B: Create user_tiers table
CREATE TABLE public.user_tiers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'flex', 'voyager', 'explorer', 'adventurer')),
  first_purchase_at TIMESTAMPTZ,
  highest_purchase TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tier"
  ON public.user_tiers FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_tiers_tier ON public.user_tiers(tier);

-- Backfill existing purchasers from credit_purchases
INSERT INTO public.user_tiers (user_id, tier, first_purchase_at, highest_purchase, updated_at)
SELECT 
  cp.user_id,
  COALESCE(
    (SELECT MAX(cp2.club_tier) FROM public.credit_purchases cp2 
     WHERE cp2.user_id = cp.user_id AND cp2.club_tier IS NOT NULL),
    'flex'
  ),
  MIN(cp.created_at),
  COALESCE(
    (SELECT MAX(cp2.club_tier) FROM public.credit_purchases cp2 
     WHERE cp2.user_id = cp.user_id AND cp2.club_tier IS NOT NULL),
    'flex'
  ),
  NOW()
FROM public.credit_purchases cp
WHERE cp.credit_type NOT IN ('free_monthly', 'signup_bonus', 'referral_bonus')
GROUP BY cp.user_id
ON CONFLICT (user_id) DO NOTHING;

-- Phase D: Create group_budgets table (pool model)
CREATE TABLE public.group_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  tier TEXT NOT NULL CHECK (tier IN ('small', 'medium', 'large')),
  initial_credits INTEGER NOT NULL,
  remaining_credits INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id)
);

ALTER TABLE public.group_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip owner can manage group budget"
  ON public.group_budgets FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Collaborators can view group budget"
  ON public.group_budgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      WHERE tc.trip_id = group_budgets.trip_id
        AND tc.user_id = auth.uid()
    )
  );

CREATE INDEX idx_group_budgets_trip ON public.group_budgets(trip_id);
CREATE INDEX idx_group_budgets_owner ON public.group_budgets(owner_id);

-- Phase D: Create group_budget_transactions table
CREATE TABLE public.group_budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_budget_id UUID NOT NULL REFERENCES public.group_budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  credits_spent INTEGER NOT NULL,
  was_free BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.group_budget_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Budget participants can view transactions"
  ON public.group_budget_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_budgets gb
      WHERE gb.id = group_budget_transactions.group_budget_id
        AND (
          gb.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.trip_collaborators tc
            WHERE tc.trip_id = gb.trip_id AND tc.user_id = auth.uid()
          )
        )
    )
  );

CREATE INDEX idx_group_transactions_budget ON public.group_budget_transactions(group_budget_id);
CREATE INDEX idx_group_transactions_user ON public.group_budget_transactions(user_id);
CREATE INDEX idx_group_transactions_created ON public.group_budget_transactions(created_at);

-- Add unlocked_day_count to trips for trip-length scaling
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS unlocked_day_count INTEGER DEFAULT 0;
