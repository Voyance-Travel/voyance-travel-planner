
-- ============================================
-- credit_purchases: Per-purchase tracking with FIFO expiration
-- ============================================
CREATE TABLE public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  credit_type TEXT NOT NULL CHECK (credit_type IN ('flex', 'club_base', 'club_bonus', 'free_monthly', 'signup_bonus', 'referral_bonus', 'migration')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  remaining INTEGER NOT NULL CHECK (remaining >= 0),
  expires_at TIMESTAMPTZ, -- NULL = never expires
  source TEXT, -- e.g. 'stripe', 'monthly_grant', 'signup', 'migration'
  stripe_session_id TEXT,
  club_tier TEXT, -- 'voyager', 'explorer', 'adventurer' for club purchases
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_purchases_user_remaining ON public.credit_purchases(user_id, remaining) WHERE remaining > 0;
CREATE INDEX idx_credit_purchases_user_expires ON public.credit_purchases(user_id, expires_at);
CREATE INDEX idx_credit_purchases_stripe ON public.credit_purchases(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit purchases"
  ON public.credit_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER update_credit_purchases_updated_at
  BEFORE UPDATE ON public.credit_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- group_unlocks: Per-trip group editing unlock
-- ============================================
CREATE TABLE public.group_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE,
  purchased_by UUID NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('small', 'medium', 'large')),
  stripe_session_id TEXT,
  caps JSONB NOT NULL DEFAULT '{}',
  usage JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_unlocks_trip ON public.group_unlocks(trip_id);
CREATE INDEX idx_group_unlocks_purchaser ON public.group_unlocks(purchased_by);

ALTER TABLE public.group_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip owner can view group unlock"
  ON public.group_unlocks FOR SELECT
  USING (public.is_trip_owner(trip_id) OR public.is_trip_collaborator(trip_id, auth.uid()));

CREATE POLICY "Users can purchase group unlock"
  ON public.group_unlocks FOR INSERT
  WITH CHECK (auth.uid() = purchased_by);

-- ============================================
-- user_badges: General badge system
-- ============================================
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_type TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, badge_type)
);

CREATE INDEX idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX idx_user_badges_type ON public.user_badges(badge_type);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges"
  ON public.user_badges FOR SELECT
  USING (true);

-- ============================================
-- Data Migration: Convert existing credits into credit_purchases rows
-- Only for users that exist in auth.users
-- ============================================
INSERT INTO public.credit_purchases (user_id, credit_type, amount, remaining, expires_at, source, created_at)
SELECT 
  cb.user_id,
  'migration',
  cb.purchased_credits,
  cb.purchased_credits,
  NULL,
  'migration',
  now()
FROM public.credit_balances cb
INNER JOIN auth.users u ON u.id = cb.user_id
WHERE cb.purchased_credits > 0;

INSERT INTO public.credit_purchases (user_id, credit_type, amount, remaining, expires_at, source, created_at)
SELECT 
  cb.user_id,
  'free_monthly',
  cb.free_credits,
  cb.free_credits,
  cb.free_credits_expires_at,
  'migration',
  now()
FROM public.credit_balances cb
INNER JOIN auth.users u ON u.id = cb.user_id
WHERE cb.free_credits > 0;
