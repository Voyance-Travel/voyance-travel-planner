-- C-REFERRAL-1: the referral program promised "you both get 150 credits" but
-- nothing recorded an attribution or granted any credits — it paid nobody. This
-- table is the attribution ledger + idempotency anchor for the claim-referral
-- edge function.
--
-- Anti-abuse baked into the schema:
--   * UNIQUE (referee_id)  → a user can be referred at most ONCE, ever. Combined
--     with ON CONFLICT DO NOTHING in the edge fn, the dual grant is idempotent
--     and a referee cannot farm repeat bonuses by re-clicking links.
--   * CHECK (referrer <> referee) → DB-level self-referral block (belt-and-
--     suspenders with the edge fn's check).
-- The edge fn additionally gates on the referee's email being verified, so
-- attribution requires a real, confirmable identity.

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  referrer_credited BOOLEAN NOT NULL DEFAULT false,
  referee_credited  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referrals_referee_unique UNIQUE (referee_id),
  CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Participants may read their own referral rows; writes are service-role only
-- (the claim-referral edge fn). No client INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "Users view own referrals" ON public.referrals;
CREATE POLICY "Users view own referrals"
  ON public.referrals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

REVOKE INSERT, UPDATE, DELETE ON public.referrals FROM anon, authenticated, PUBLIC;
