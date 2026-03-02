
CREATE OR REPLACE FUNCTION public.fulfill_credit_purchase(
  p_user_id uuid,
  p_credits int,
  p_bonus_credits int,
  p_credit_type text,
  p_stripe_session_id text,
  p_amount_cents int,
  p_club_tier text DEFAULT NULL,
  p_product_id text DEFAULT NULL,
  p_price_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus_expires timestamptz;
  v_flex_expires timestamptz;
  v_now timestamptz := now();
  v_ledger_action text;
  v_ledger_notes text;
  v_total_credits int;
BEGIN
  v_total_credits := p_credits + p_bonus_credits;

  IF p_credit_type IN ('club_base', 'club') AND p_club_tier IS NOT NULL THEN
    v_bonus_expires := v_now + interval '6 months';

    INSERT INTO public.credit_purchases (user_id, credit_type, amount, remaining, expires_at, source, stripe_session_id, club_tier)
    VALUES (p_user_id, 'club_base', p_credits, p_credits, NULL, 'stripe', p_stripe_session_id, p_club_tier);

    IF p_bonus_credits > 0 THEN
      INSERT INTO public.credit_purchases (user_id, credit_type, amount, remaining, expires_at, source, stripe_session_id, club_tier)
      VALUES (p_user_id, 'club_bonus', p_bonus_credits, p_bonus_credits, v_bonus_expires, 'stripe', p_stripe_session_id, p_club_tier);
    END IF;

    INSERT INTO public.user_badges (user_id, badge_type, source, metadata)
    VALUES (p_user_id, 'club_' || p_club_tier, 'purchase', jsonb_build_object('stripe_session_id', p_stripe_session_id, 'tier', p_club_tier))
    ON CONFLICT (user_id, badge_type) DO NOTHING;

    IF p_club_tier = 'adventurer' THEN
      PERFORM public.award_founding_member(p_user_id, p_stripe_session_id);
      INSERT INTO public.user_badges (user_id, badge_type, source, metadata)
      VALUES (p_user_id, 'founding_member', 'purchase', jsonb_build_object('stripe_session_id', p_stripe_session_id))
      ON CONFLICT (user_id, badge_type) DO NOTHING;
    END IF;

    v_ledger_action := 'club_purchase';
    v_ledger_notes := p_club_tier || ' club pack - ' || v_total_credits || ' credits (' || p_credits || ' base + ' || p_bonus_credits || ' bonus)';
  ELSE
    v_flex_expires := v_now + interval '12 months';

    INSERT INTO public.credit_purchases (user_id, credit_type, amount, remaining, expires_at, source, stripe_session_id)
    VALUES (p_user_id, 'flex', v_total_credits, v_total_credits, v_flex_expires, 'stripe', p_stripe_session_id);

    v_ledger_action := 'stripe_purchase';
    v_ledger_notes := 'Flex credit pack - ' || v_total_credits || ' credits';
  END IF;

  -- Ledger insert — unique index enforces idempotency at DB level
  BEGIN
    INSERT INTO public.credit_ledger (user_id, transaction_type, action_type, credits_delta, is_free_credit, stripe_session_id, stripe_product_id, price_id, amount_cents, notes)
    VALUES (p_user_id, 'purchase', v_ledger_action, v_total_credits, false, p_stripe_session_id, p_product_id, p_price_id, p_amount_cents, v_ledger_notes);
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent duplicate — roll back the whole transaction implicitly
    -- by raising and catching at the outer level
    RAISE NOTICE 'Duplicate stripe_session_id %, returning idempotent response', p_stripe_session_id;
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'already_fulfilled');
  END;

  -- Sync balance cache
  UPDATE public.credit_balances
  SET 
    purchased_credits = (
      SELECT COALESCE(SUM(remaining), 0)::int
      FROM public.credit_purchases
      WHERE credit_purchases.user_id = p_user_id
        AND remaining > 0
        AND credit_type != 'free'
        AND (expires_at IS NULL OR expires_at > v_now)
    ),
    free_credits = (
      SELECT COALESCE(SUM(remaining), 0)::int
      FROM public.credit_purchases
      WHERE credit_purchases.user_id = p_user_id
        AND remaining > 0
        AND credit_type = 'free'
        AND (expires_at IS NULL OR expires_at > v_now)
    ),
    updated_at = v_now
  WHERE credit_balances.user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'skipped', false,
    'credits', v_total_credits,
    'type', CASE WHEN p_club_tier IS NOT NULL THEN 'club' ELSE 'flex' END
  );
END;
$$;
