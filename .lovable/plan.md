
# Lock In Final Credit Pricing Model

## What's Changing

The current pricing config and backend have outdated credit costs and are missing key concepts from the final model. Here's the gap:

| Item | Current | Final |
|------|---------|-------|
| Unlock Day | 90 credits | 60 credits |
| Smart Finish | $6.99 Stripe checkout | 50 credits |
| Swap Activity | 15 credits (always) | 5 credits (after 10 free/trip) |
| Regenerate Day | 90 credits (always) | 10 credits (after 5 free/trip) |
| AI Message | 10 credits (always) | 5 credits (after 20 free/trip) |
| Restaurant Rec | 15 credits (always) | 5 credits (after 5 free/trip) |
| Free action caps | Not implemented | Per-trip free usage caps |

Flexible credit packs, Voyance Club packs, monthly grants, and free-credits-first spending logic are all already correct -- no changes needed.

Multi-city fees and complexity multipliers are already implemented and tracking in `trip_complexity`. No changes needed.

Free actions (route optimization, nearby suggestions, local events) are either already set to 0 cost or not in the cost map at all -- safe, no risk of accidental charging.

## Implementation Steps

### 1. Database: Add per-trip action usage tracking

Create a `trip_action_usage` table to track free cap consumption per trip:

```text
trip_action_usage
-----------------
id (uuid, PK)
user_id (uuid, NOT NULL)
trip_id (uuid, NOT NULL, FK -> trips)
action_type (text, NOT NULL)  -- swap_activity, regenerate_day, ai_message, restaurant_rec
usage_count (int, default 0)
updated_at (timestamptz)
UNIQUE(user_id, trip_id, action_type)
```

RLS policies: Users can only SELECT/INSERT/UPDATE their own rows.

### 2. Update `src/config/pricing.ts`

- `UNLOCK_DAY`: 90 -> 60
- `SWAP_ACTIVITY`: 15 -> 5
- `REGENERATE_DAY`: 90 -> 10
- `AI_MESSAGE`: 10 -> 5
- `RESTAURANT_REC`: 15 -> 5
- Add `SMART_FINISH: 50`
- Add `FREE_ACTION_CAPS` config:

```text
FREE_ACTION_CAPS = {
  swap_activity: 10,
  regenerate_day: 5,
  ai_message: 20,
  restaurant_rec: 5,
}
```

- Update `BASE_RATE_PER_DAY` from 90 to 60 (referenced in trip cost examples and internal cost docs)

### 3. Update `spend-credits` edge function

- Update `FIXED_COSTS` to new values: unlock_day=60, swap_activity=5, regenerate_day=10, ai_message=5, restaurant_rec=5
- Add `smart_finish: 50` to fixed costs
- Change `BASE_RATE_PER_DAY` from 90 to 60
- Add free cap logic: when a capped action comes in with a `tripId`, query `trip_action_usage`. If usage is under the cap, increment usage count and return success with 0 credits spent. If at/over cap, charge credits normally.

### 4. Convert Smart Finish from Stripe to credits

Update `SmartFinishBanner.tsx`:
- Replace the "$6.99" Stripe checkout button with "50 credits" credit-based purchase
- Call `spend-credits` with action `smart_finish` instead of invoking `purchase-smart-finish`
- On success, mark `smart_finish_purchased = true` on the trip and trigger enrichment
- The `purchase-smart-finish` edge function becomes unused (cleanup later)

### 5. Create `useActionCap` hook

New hook for components to check free cap status:

```text
useActionCap(tripId, actionType)
  -> { isFree: boolean, usedCount: number, freeRemaining: number, creditCost: number, isLoading: boolean }
```

Queries `trip_action_usage` for the current user + trip + action type.

### 6. Update `useSpendCredits` hook

- Add `SMART_FINISH: 'smart_finish'` to the `ACTION_MAP`
- Existing flow handles everything else automatically

### 7. Update frontend components

- `ItineraryAssistant.tsx`: Use `useActionCap` to show "Free" vs "5 credits" for chat messages
- `DNAFeedbackChat.tsx`: Same pattern for AI messages
- `AiFeatureGate.tsx`: Update copy from "requires Smart Finish or credits" to "requires credits"
- `useFreeTierLimits.ts`: Values auto-update from `CREDIT_COSTS` changes
- `LockedDayCard.tsx`, `CreditNudge.tsx`: Auto-update from config
- `Pricing.tsx`: Update any hardcoded credit amounts in marketing copy

### 8. Update `tripCostCalculator.ts`

Change `BASE_RATE_PER_DAY` from 90 to 60 so new trip estimates reflect the final pricing.

## Files Changed

| File | Change |
|------|--------|
| New migration | `trip_action_usage` table + RLS + unique index |
| `src/config/pricing.ts` | Updated costs, added `FREE_ACTION_CAPS`, `SMART_FINISH` |
| `src/lib/tripCostCalculator.ts` | `BASE_RATE_PER_DAY` 90 -> 60 |
| `supabase/functions/spend-credits/index.ts` | New costs + free cap logic |
| `src/components/itinerary/SmartFinishBanner.tsx` | Credit-based instead of Stripe |
| `src/hooks/useSpendCredits.ts` | Add `SMART_FINISH` to action map |
| `src/hooks/useActionCap.ts` | New hook for free cap checking |
| `src/components/itinerary/ItineraryAssistant.tsx` | Free cap display |
| `src/components/profile/DNAFeedbackChat.tsx` | Free cap display |
| `src/components/itinerary/AiFeatureGate.tsx` | Updated copy |
| `src/pages/Pricing.tsx` | Updated credit amounts in copy |

## What Stays the Same

- Flexible Credits packs (100/$9, 300/$25, 500/$39)
- Voyance Club packs (Voyager/Explorer/Adventurer)
- Monthly grant (150 credits, 2-month expiry, 300 cap)
- Multi-city fees (+60/+120/+180 cap) -- already live
- Complexity multiplier (1.00x/1.15x/1.30x) -- already live
- Free-credits-first spending order
- Round-up logic (drain to zero if over half)
- Ledger/accounting system
