
-- Add 'topup' and 'manual_grant' to allowed credit_type values
ALTER TABLE public.credit_purchases DROP CONSTRAINT credit_purchases_credit_type_check;
ALTER TABLE public.credit_purchases ADD CONSTRAINT credit_purchases_credit_type_check 
  CHECK (credit_type = ANY (ARRAY['flex', 'club_base', 'club_bonus', 'free_monthly', 'signup_bonus', 'referral_bonus', 'migration', 'topup', 'manual_grant']));
