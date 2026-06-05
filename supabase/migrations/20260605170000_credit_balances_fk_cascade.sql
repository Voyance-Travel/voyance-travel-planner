-- C-CRED-9: public.credit_balances.user_id was declared `UUID NOT NULL UNIQUE`
-- with NO foreign key to auth.users — so deleting an account left the balance row
-- behind. A live SQL check found 20 such orphans (38 rows vs 24 auth users; 0 are
-- multi-row, the UNIQUE index holds, so balances are NOT non-deterministic — this
-- is inert dead data, low severity). But the missing cascade is a real schema gap:
-- contrast user_tiers, which correctly uses `REFERENCES auth.users(id) ON DELETE CASCADE`.
--
-- (1) Remove existing orphans (prerequisite — the FK add would fail otherwise).
-- (2) Add the FK with ON DELETE CASCADE so future account deletions clean up
--     automatically (and credit_balances no longer needs the manual sweep in the
--     delete-users edge function).

-- 1) Delete balance rows whose user no longer exists in auth.users.
DELETE FROM public.credit_balances cb
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cb.user_id);

-- 2) Add the missing FK (idempotent — drop first if a prior partial run added it).
ALTER TABLE public.credit_balances
  DROP CONSTRAINT IF EXISTS credit_balances_user_id_fkey;

ALTER TABLE public.credit_balances
  ADD CONSTRAINT credit_balances_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
