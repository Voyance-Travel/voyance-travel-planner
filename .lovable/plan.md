

## Fix: Group Unlock Stripe Payment, Checkout Z-Index, and Photo Persist Bugs

Four targeted fixes across 4 files. All changes are isolated and low-risk.

### Bug 1: EmbeddedCheckoutModal z-index
**File:** `src/components/checkout/EmbeddedCheckoutModal.tsx` line 94  
Change `z-50` → `z-[60]` so Stripe checkout renders above Dialog overlays.

### Bug 2: Stripe group_unlock missing group_budgets row
**File:** `supabase/functions/stripe-webhook/index.ts` lines 559-566  
After the `group_unlocks` insert, add a `group_budgets` insert with tier-based credits (small=150, medium=300, large=500). Also add `add_activity: 0` to the usage object. This mirrors what `purchase-group-unlock` already does for credit-based purchases.

### Bug 3: Duplicate `await supabase` in useStalePendingChargeRefund
**File:** `src/hooks/useStalePendingChargeRefund.ts` lines 53-54  
Remove the orphaned `await supabase` line, keeping only the actual query `await (supabase.from(...)...`.

### Bug 4: Photo persist fails on non-UUID activity IDs
**File:** `src/hooks/useActivityImage.ts` line 58  
Add a UUID regex guard at the top of `persistPhotoToActivity`. If the activityId doesn't match UUID format, return early silently. This prevents errors for shared trip activities with slug IDs like `"sh-day1-dinner"`.

