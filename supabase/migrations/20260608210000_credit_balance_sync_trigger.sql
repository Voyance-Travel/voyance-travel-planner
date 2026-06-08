-- Keep credit_balances (the cached aggregate) ALWAYS in sync with credit_purchases
-- (the source of truth). Previously the cache was maintained by each edge function /
-- RPC individually; the canonical purchase path (fulfill_credit_purchase) recomputed
-- correctly, but other paths (manual grants, bonuses, test top-ups) could update the
-- cache imperfectly and drift it (right total, wrong purchased/free split — observed live).
--
-- This trigger recomputes the affected user's credit_balances from credit_purchases on
-- ANY change to that table, so the cache can never diverge from the source of truth.
-- Categorization matches reconcile_credit_balances() exactly.

CREATE OR REPLACE FUNCTION public.sync_credit_balance_from_purchases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_purchased bigint;
  v_free bigint;
BEGIN
  IF v_user IS NULL THEN RETURN NULL; END IF;

  SELECT
    COALESCE(SUM(remaining) FILTER (WHERE credit_type IN
      ('flex','club_base','topup','migration','manual_grant')), 0),
    COALESCE(SUM(remaining) FILTER (WHERE credit_type IN
      ('free_monthly','signup_bonus','referral_bonus','club_bonus','refund')), 0)
  INTO v_purchased, v_free
  FROM public.credit_purchases
  WHERE user_id = v_user
    AND remaining > 0
    AND (expires_at IS NULL OR expires_at > now());

  INSERT INTO public.credit_balances (user_id, purchased_credits, free_credits, updated_at)
  VALUES (v_user, v_purchased, v_free, now())
  ON CONFLICT (user_id) DO UPDATE
    SET purchased_credits = EXCLUDED.purchased_credits,
        free_credits      = EXCLUDED.free_credits,
        updated_at        = now();

  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_credit_balance ON public.credit_purchases;
CREATE TRIGGER trg_sync_credit_balance
  AFTER INSERT OR DELETE OR UPDATE OF remaining, expires_at, credit_type, user_id
  ON public.credit_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_credit_balance_from_purchases();
