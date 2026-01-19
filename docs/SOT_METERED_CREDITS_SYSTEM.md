# Metered Credits System - Source of Truth

> **Status**: Implementation in progress  
> **Last Updated**: 2026-01-19  
> **Owner**: Voyance Platform

---

## Overview

The metered credit system allows users to pay-per-action for specific features without committing to a subscription. Users load credits into their wallet (min $5.00) and spend them on discrete actions.

---

## Credit Costs (in cents)

| Action Key | Description | Cost | UI Label |
|------------|-------------|------|----------|
| `build_day` | AI-generate activities for one day | 399 ($3.99) | Build 1 day |
| `build_full_trip` | AI-generate complete itinerary | 999 ($9.99) | Build full trip |
| `route_optimize` | Optimize travel between activities | 199 ($1.99) | Route + transportation |
| `group_budget_setup` | Auto-split expenses for group | 299 ($2.99) | Group budget setup |

**Minimum Top-up**: $5.00 (500 cents)

---

## Database Schema

### `user_credits` Table
Stores each user's current credit balance.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID (PK) | References auth.users |
| `balance_cents` | INTEGER | Current balance in cents |
| `created_at` | TIMESTAMPTZ | When row was created |
| `updated_at` | TIMESTAMPTZ | Last modification time |

### `credit_transactions` Table
Audit trail for all credit changes (top-ups and spends).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Transaction ID |
| `user_id` | UUID | References user_credits |
| `type` | TEXT | 'topup' or 'spend' |
| `amount_cents` | INTEGER | Amount changed (positive for topup, negative for spend) |
| `action_key` | TEXT | For spends: which action was purchased |
| `metadata` | JSONB | Additional context (stripe session ID, trip ID, etc.) |
| `created_at` | TIMESTAMPTZ | Transaction timestamp |

---

## Feature Gating Logic

### How Features Are Unlocked

Features can be unlocked in three ways:

1. **Subscription** (Monthly/Yearly): All metered features included
2. **Trip Pass**: All features for one specific trip
3. **Credits**: Pay per action from wallet balance

### Entitlement Check Priority

```
1. Is user on Monthly/Yearly plan? → Feature enabled
2. Does user have Trip Pass for this trip? → Feature enabled for this trip
3. Does user have sufficient credits? → Feature available if balance >= cost
4. Default → Feature locked (show upgrade prompt)
```

---

## Edge Function: `consume-credits`

Handles the actual deduction of credits when a user performs a metered action.

### Request Body
```json
{
  "action_key": "build_day" | "build_full_trip" | "route_optimize" | "group_budget_setup",
  "trip_id": "uuid" // Optional: for audit trail
}
```

### Response (Success)
```json
{
  "success": true,
  "action_key": "build_day",
  "amount_spent": 399,
  "new_balance": 601
}
```

### Response (Insufficient Funds)
```json
{
  "success": false,
  "error": "insufficient_credits",
  "required": 399,
  "balance": 200
}
```

---

## Edge Function: `get-entitlements`

Returns feature availability flags including credit-based access.

### Response Shape
```json
{
  "user_id": "uuid",
  "plan": "free" | "monthly" | "yearly",
  "credits_balance_cents": 1500,
  
  // Feature flags
  "can_build_itinerary": true,
  "can_use_group_budgeting": false,
  "can_optimize_routes": false,
  
  // Credit-based feature availability
  "credit_features": {
    "build_day": { "cost": 399, "can_afford": true },
    "build_full_trip": { "cost": 999, "can_afford": true },
    "route_optimize": { "cost": 199, "can_afford": true },
    "group_budget_setup": { "cost": 299, "can_afford": true }
  }
}
```

---

## Frontend Integration

### Checking Feature Access

```typescript
import { useEntitlements } from '@/hooks/useEntitlements';
import { CREDIT_COSTS } from '@/config/pricing';

function RouteOptimizeButton({ tripId }: { tripId: string }) {
  const { entitlements, isPaid } = useEntitlements();
  
  // Paid users always have access
  if (isPaid) {
    return <Button onClick={handleOptimize}>Optimize Route</Button>;
  }
  
  // Check if user can afford with credits
  const canAfford = entitlements?.credits_balance_cents >= CREDIT_COSTS.ROUTE_OPTIMIZE;
  
  if (canAfford) {
    return (
      <Button onClick={() => consumeCreditsAndOptimize(tripId)}>
        Optimize Route (${(CREDIT_COSTS.ROUTE_OPTIMIZE / 100).toFixed(2)})
      </Button>
    );
  }
  
  return (
    <UpgradePrompt feature="route_optimize" reason="insufficient_credits" />
  );
}
```

### Consuming Credits

```typescript
import { supabase } from '@/integrations/supabase/client';

async function consumeCredits(actionKey: string, tripId?: string) {
  const { data, error } = await supabase.functions.invoke('consume-credits', {
    body: { action_key: actionKey, trip_id: tripId }
  });
  
  if (error || !data.success) {
    if (data?.error === 'insufficient_credits') {
      // Show add credits modal
      showAddCreditsModal(data.required, data.balance);
      return false;
    }
    throw new Error(error?.message || data?.error);
  }
  
  return true;
}
```

---

## Stripe Webhook: Credit Fulfillment

When a credit top-up checkout succeeds, the webhook handler:

1. Verifies the Stripe signature
2. Checks `metadata.type === 'credit_topup'`
3. Extracts `metadata.user_id` and `metadata.amount_cents`
4. Upserts into `user_credits` table
5. Inserts audit record into `credit_transactions`

---

## Pricing Page Messaging

### Current Issue
The "min $5 top-up" messaging is confusing when individual actions cost less than $5.

### Recommended UX

Instead of showing the top-up minimum upfront, the UI should:

1. **Primary message**: "Pay only for what you use"
2. **Action menu**: Show the four actions with their prices
3. **On click**: If balance < cost, show "Add at least $X to your wallet" where X = max(5.00, action cost)

### Example Flow

1. User clicks "Build 1 Day ($3.99)"
2. System checks balance
3. If balance < 399 cents:
   - Show modal: "You need $3.99 to build this day. Add funds to continue."
   - Buttons: "Add $5" / "Add $10" / "Add $20" / "Cancel"
4. After successful payment, proceed with action

---

## Security Considerations

1. **Credit deduction is server-side only** — Never trust client-side balance
2. **Atomic operations** — Use database transactions for deduct + action
3. **Audit trail** — Every credit change logged in `credit_transactions`
4. **Balance can't go negative** — Check before deducting
5. **Rate limiting** — Prevent rapid-fire API abuse

---

## Migration Checklist

- [ ] Create `credit_transactions` table if not exists
- [ ] Create `consume-credits` edge function
- [ ] Update `get-entitlements` to include `credit_features`
- [ ] Add Stripe webhook handler for credit fulfillment
- [ ] Update frontend hooks to check credit-based access
- [ ] Update Pricing page UX for clearer messaging

---

## Related Files

- `src/config/pricing.ts` — Credit costs configuration
- `supabase/functions/consume-credits/index.ts` — Credit deduction logic
- `supabase/functions/add-credits/index.ts` — Stripe checkout for top-ups
- `supabase/functions/get-entitlements/index.ts` — Entitlement calculation
- `src/hooks/useEntitlements.ts` — Frontend entitlement hooks
- `src/components/common/UpgradePrompt.tsx` — Upgrade/add credits UI
