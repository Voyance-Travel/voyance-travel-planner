

# Add Daily Cron Job to Sync Expired Credit Balances

## Problem
When free credits expire (after 2 months), the `credit_balances` cache row may still show stale `free_credits` values until the next spend or grant event triggers a recalculation. Users could briefly see outdated balances.

## Solution
Add a lightweight SQL function + daily cron job that recalculates `free_credits` in `credit_balances` for any user whose `free_credits_expires_at` has passed. No edge function needed -- pure SQL, matching the existing `cleanup_rate_limits` pattern.

## Technical Changes

### 1. New database function: `sync_expired_credit_balances()`

```sql
CREATE OR REPLACE FUNCTION public.sync_expired_credit_balances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Recalculate free_credits for users whose expiry has passed
  UPDATE public.credit_balances cb
  SET 
    free_credits = (
      SELECT COALESCE(SUM(cp.remaining), 0)::int
      FROM public.credit_purchases cp
      WHERE cp.user_id = cb.user_id
        AND cp.remaining > 0
        AND cp.credit_type IN ('free_monthly', 'signup_bonus', 'referral_bonus')
        AND (cp.expires_at IS NULL OR cp.expires_at > now())
    ),
    purchased_credits = (
      SELECT COALESCE(SUM(cp.remaining), 0)::int
      FROM public.credit_purchases cp
      WHERE cp.user_id = cb.user_id
        AND cp.remaining > 0
        AND cp.credit_type NOT IN ('free_monthly', 'signup_bonus', 'referral_bonus')
        AND (cp.expires_at IS NULL OR cp.expires_at > now())
    ),
    updated_at = now()
  WHERE cb.free_credits > 0
    AND cb.free_credits_expires_at IS NOT NULL
    AND cb.free_credits_expires_at < now();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
```

### 2. Daily cron schedule (runs at 1 AM UTC)

```sql
SELECT cron.schedule(
  'sync-expired-credit-balances',
  '0 1 * * *',
  $$SELECT public.sync_expired_credit_balances()$$
);
```

## What this does NOT change
- No edge functions created
- No changes to `spend-credits`, `grant-monthly-credits`, or `useCredits` hook
- No changes to the FIFO deduction logic
- Expired `credit_purchases` rows are not deleted (they remain for audit/history)

## File
- 1 new SQL migration file

