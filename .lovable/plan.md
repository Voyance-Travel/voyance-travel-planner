
# Fix Regenerate + Add Regeneration Credit Charging

## Problem Summary

1. **Regenerate does nothing**: The "Regenerate" button opens a confirmation dialog, which calls `handleRegenerateItinerary`. This invokes `generate-itinerary` with `action: 'generate-full'` -- a full 7-stage pipeline that takes 30-60+ seconds. The function likely times out (504), and there's no timeout reconciliation like the initial generation has. The toast disappears after 5 seconds, giving zero feedback. No error is shown.

2. **No credit charge**: `handleRegenerateItinerary` skips credit spending entirely -- it calls the edge function directly without going through `spendCredits`. The original generation costs 60 credits/day. Regeneration should cost half (30 credits/day).

3. **No credit tracking for regeneration**: There's no `regenerate_trip` action in the spend-credits system or the credit ledger to track full trip regenerations.

---

## Plan

### Task 1: Add `regenerate_trip` as a new credit action

**Backend** (`supabase/functions/spend-credits/index.ts`):
- Add `'regenerate_trip'` to `VARIABLE_COST_ACTIONS` array (since cost depends on trip length)
- This allows dynamic `creditsAmount` to be passed from the frontend

**Frontend** (`src/hooks/useSpendCredits.ts`):
- Add `REGENERATE_TRIP: 'regenerate_trip'` to the `ACTION_MAP`

**Frontend** (`src/config/pricing.ts`):
- Add `REGENERATE_TRIP: 0` as a placeholder (same pattern as `TRIP_GENERATION` since it's variable-cost)
- Add a comment noting that actual cost = half of original generation cost

### Task 2: Fix `handleRegenerateItinerary` to charge credits and show proper loading

**In `EditorialItinerary.tsx`**, rewrite `handleRegenerateItinerary`:

1. **Calculate regeneration cost**: Look up the trip's day count from the current `days` array. Cost = `Math.ceil((days.length * 60) / 2)` (half the original 60/day rate = 30/day).

2. **Charge credits first**: Call `spendCredits.mutateAsync({ action: 'REGENERATE_TRIP', tripId, creditsAmount: regenerationCost })` before invoking the edge function. If it fails (insufficient credits), the `OutOfCreditsModal` will show automatically.

3. **Show persistent loading overlay**: Replace the 5-second toast with a full-screen or inline loading state that persists until completion. Use `isRegenerating` state to show a blocking overlay with a spinner and message like "Rebuilding your itinerary... This may take a minute."

4. **Add timeout reconciliation**: If the edge function call fails with a timeout (504), implement the same polling pattern used in the initial generation -- poll the `trips` table for updated `itinerary_data` for up to 90 seconds before giving up.

5. **Show credit cost in the confirmation dialog**: Update the regenerate confirmation dialog to display how many credits will be charged ("This will cost X credits").

### Task 3: Add a regeneration loading overlay

Create a simple inline banner/overlay component that shows during regeneration:
- Spinner + "Rebuilding your itinerary..."
- "This may take up to a minute"  
- Disable all editing controls while regenerating
- This uses the existing `isRegenerating` state -- just wire it to a visible, persistent UI element instead of a vanishing toast

### Task 4: Log regeneration in the credit ledger

The `spend-credits` edge function already writes to the `credit_ledger` when deducting credits. Adding `regenerate_trip` to `VARIABLE_COST_ACTIONS` means it will automatically:
- Create a ledger entry with `action_type: 'regenerate_trip'`
- Record the `trip_id` and `credits_delta`
- Track it in the existing `credit_purchases` FIFO system

No new database tables needed -- the existing `credit_ledger` and `credit_purchases` tables handle this.

---

## Technical Details

### Credit cost formula
- Original generation: `days x 60 credits/day`
- Regeneration: `days x 30 credits/day` (half price)
- Example: 5-day trip = 150 credits to regenerate

### Files to modify
| File | Change |
|------|--------|
| `src/config/pricing.ts` | Add `REGENERATE_TRIP: 0` placeholder |
| `src/hooks/useSpendCredits.ts` | Add `REGENERATE_TRIP` to `ACTION_MAP` |
| `supabase/functions/spend-credits/index.ts` | Add `'regenerate_trip'` to `VARIABLE_COST_ACTIONS` |
| `src/components/itinerary/EditorialItinerary.tsx` | Rewrite `handleRegenerateItinerary` with credit charge, loading state, timeout reconciliation, and cost display in dialog |

### Edge cases handled
- User lacks credits: `OutOfCreditsModal` pops up (existing behavior from `useSpendCredits`)
- Edge function times out: Poll DB for up to 90 seconds
- Edge function fails after credits charged: Show error toast with suggestion to retry (credits are spent; refund path can be added later if needed)
- First trip (free): The `spend-credits` function handles free-trip logic server-side; regeneration on a first trip would still cost half since it's a re-generation (not initial generation)
