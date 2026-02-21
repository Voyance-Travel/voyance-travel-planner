-- Change purchased_credits to bigint to prevent overflow
ALTER TABLE credit_balances
ALTER COLUMN purchased_credits TYPE bigint;

-- Also change free_credits to bigint for consistency
ALTER TABLE credit_balances
ALTER COLUMN free_credits TYPE bigint;