
# Implementation Plan: Complete Pricing & Feature Gating Rollout

## Overview

Six phases implementing feature gating, tier system, free action caps, group credit pools, and generation gate cleanup. All confirmed numbers applied.

## Existing State

| Component | Current Status |
|-----------|---------------|
| `credit_purchases` table | Exists (FIFO with `credit_type`, `remaining`, `expires_at`, `club_tier`) |
| `trip_action_usage` table | Exists (`user_id`, `trip_id`, `action_type`, `usage_count`) |
| `group_unlocks` table | Exists (Stripe-based, JSONB `caps`/`usage`) |
| `user_tiers` table | Does NOT exist |
| `group_budgets` table | Does NOT exist |
| `group_budget_transactions` table | Does NOT exist |
| `spend-credits` function | Flat caps: 10/5/20/5 for all owners |
| `get-entitlements` function | No feature gating, no tier info, no trip context |
| `useGenerationGate` hook | First-trip = free 2 days, else balance >= cost or LOCKED |
| `EditorialItinerary.tsx` (6337 lines) | Uses `isPreview` per-day lock, `smartFinishPurchased` state, `useEntitlements()` at line 1036 |

---

## Phase A: Feature Gating by Access Level

### Access Rule

Premium content visible if ANY of:
- `hasCompletedPurchase` -- any `credit_purchases` row where `credit_type NOT IN ('free_monthly', 'signup_bonus', 'referral_bonus')`
- `isFirstTrip && dayNumber <= 2` -- first trip gift days
- `tripHasSmartFinish` -- `trips.smart_finish_purchased = true`

PDF export requires purchase or Smart Finish only (never free on first trip).

### Backend: `get-entitlements/index.ts` (rewrite)

1. Keep existing auth flow (lines 86-112) and Stripe subscription check (lines 118-145)
2. Keep credit balance calculation (lines 147-159)
3. Add three new queries after the balance check:
   - Purchase status: `SELECT 1 FROM credit_purchases WHERE user_id = $1 AND credit_type NOT IN ('free_monthly', 'signup_bonus', 'referral_bonus') LIMIT 1`
   - First trip: `SELECT count FROM (SELECT id FROM trips WHERE user_id = $1 AND itinerary_status IS NOT NULL LIMIT 1)` -- same logic as `useGenerationGate.checkIsFirstTrip`
   - Smart Finish (if `tripId` in body): `SELECT smart_finish_purchased FROM trips WHERE id = $tripId`
4. Accept optional `tripId` in request body (parse with `await req.json().catch(() => ({}))` to handle GET-style calls)
5. Add tier lookup from `user_tiers` table (default 'free')
6. Add trip usage lookup from `trip_action_usage` (if tripId provided)
7. Compute tier-based free caps (see Phase B tables)
8. Return expanded response with all new fields

### Backend: `generate-itinerary/index.ts`

Before calling Google Places photo API for each activity, check access:
- `hasCompletedPurchase || (isFirstTrip && dayNumber <= 2) || tripHasSmartFinish`
- When false, set `photoUrl = null` (saves ~$0.045/day in Google API costs)

### Frontend: `useEntitlements.ts`

Add to `EntitlementsResponse` type:
- `has_completed_purchase`, `is_first_trip`, `trip_has_smart_finish`
- `can_view_photos`, `can_view_addresses`, `can_view_booking_links`, `can_view_tips`, `can_view_reviews`, `can_export_pdf`
- `tier`, `free_caps`, `trip_usage`, `remaining_free_actions`
- `costs` (already partially there)

Add helper function:
```
canViewPremiumContentForDay(entitlements, dayNumber): boolean
```

### New Components

**`src/components/itinerary/LockedPhotoPlaceholder.tsx`**: Gray gradient with lock icon, "Upgrade to view photos" text, link to pricing page.

**`src/components/itinerary/LockedField.tsx`**: Compact inline with icon + "Unlock to see [field]" + lock icon.

### `EditorialItinerary.tsx` Changes

The file already has `useEntitlements()` at line 1036 and `smartFinishPurchased` state at line 1053. Changes:

For each activity in each day, compute `canViewPremium = canViewPremiumContentForDay(entitlements, dayNumber)`:

- **Photos**: Add `&& canViewPremium` to photo fetch condition. When false, render `LockedPhotoPlaceholder`.
- **Addresses**: Change `!isPreview` checks to `!isPreview && canViewPremium`. When gated, render `LockedField` with MapPin icon and "Unlock to see address".
- **Tips/Insights**: Same pattern. Render `LockedField` with Lightbulb icon.
- **Reviews/Ratings**: Wrap rating section in `canViewPremium` check. Render `LockedField` with Star icon.
- **Booking links**: Add `&& canViewPremium` to booking section. Render `LockedField` with ExternalLink icon.
- **PDF export**: Gate behind `can_export_pdf` from entitlements.

Note: Exact line numbers may shift -- the logic patterns (`!isPreview` guards) are what matter.

---

## Phase B: Tier System and Tier-Based Free Caps

### Database Migration: Create `user_tiers` table

```sql
CREATE TABLE public.user_tiers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'flex', 'voyager', 'explorer', 'adventurer')),
  first_purchase_at TIMESTAMPTZ,
  highest_purchase TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tier"
  ON public.user_tiers FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_tiers_tier ON public.user_tiers(tier);
```

Backfill from `credit_purchases`:
```sql
INSERT INTO user_tiers (user_id, tier, first_purchase_at, highest_purchase)
SELECT cp.user_id,
  COALESCE(MAX(cp.club_tier), 'flex'),
  MIN(cp.created_at),
  COALESCE(MAX(cp.club_tier), 'flex')
FROM credit_purchases cp
WHERE cp.credit_type NOT IN ('free_monthly', 'signup_bonus', 'referral_bonus')
GROUP BY cp.user_id
ON CONFLICT (user_id) DO NOTHING;
```

### `stripe-webhook/index.ts` Update

After credit purchase fulfillment (around line 382), upsert `user_tiers`. For club packs, use `clubInfo.tier`. For flex packs, use 'flex'. Only upgrade, never downgrade using tier hierarchy: free(0) < flex(1) < voyager(2) < explorer(3) < adventurer(4).

### `spend-credits/index.ts` Update

Replace flat `FREE_CAPS` (lines 30-35, currently 10/5/20/5) with:

**Tier Caps:**

| Tier | Swaps | Regens | AI Messages | Restaurant | Total |
|------|-------|--------|-------------|------------|-------|
| free | 3 | 1 | 5 | 1 | 10 |
| flex | 3 | 1 | 5 | 1 | 10 |
| voyager | 6 | 2 | 10 | 2 | 20 |
| explorer | 9 | 3 | 15 | 3 | 30 |
| adventurer | 15 | 5 | 25 | 5 | 50 |

**Trip Length Scaling (Free/Flex only):**

| Days Unlocked | Swaps | Regens | AI | Restaurant | Total |
|---------------|-------|--------|----|------------|-------|
| 1-2 | 3 | 1 | 5 | 1 | 10 |
| 3-4 | 5 | 2 | 10 | 2 | 19 |
| 5-6 | 7 | 3 | 15 | 3 | 28 |
| 7+ | 10 | 4 | 20 | 4 | 38 |

Implementation in `spend-credits`:
1. Before the free cap check (line 276), query `user_tiers` for the user's tier (default 'free')
2. If not club member (voyager/explorer/adventurer), count unlocked days on the trip and use scaled cap table
3. Club members use their tier caps regardless of trip length
4. Return `tier`, `freeCap`, `usageCount`, `remainingFree` in response for UI use

### `pricing.ts` Update

Replace `FREE_ACTION_CAPS` (lines 34-39) with tier-based object matching the tables above.

---

## Phase C: Free Actions Counter and Modal

### `src/components/itinerary/FreeActionsCounter.tsx`

Compact sidebar component showing:
- Remaining swaps, regens, AI messages, restaurant recs per trip
- Club tier badge if applicable
- Warning state + "Get more credits" CTA when all exhausted

Uses `remaining_free_actions` from entitlements response.

### `src/components/modals/OutOfFreeActionsModal.tsx`

Triggered when free uses exhausted for an action type:
- Title: "You've used your free [action]s"
- Shows per-action cost (e.g., "5 credits per swap")
- If affordable: "Continue -- 5 credits" button
- If not affordable: "Get more credits" button

### Wiring

After each `spend-credits` call, use response fields (`freeCapUsed`, `usageCount`, `freeCap`, `remainingFree`) to:
1. Update `FreeActionsCounter` display
2. Show toast when last free action is used
3. Show `OutOfFreeActionsModal` on next attempt if beyond cap

---

## Phase D: Group Unlock (Credit-Based Pool Model)

### Current State

`group_unlocks` table uses fixed-cap model with JSONB `caps`/`usage` columns, purchased via Stripe. The `spend-credits` function reads from it (lines 214-273) for collaborator cap checks.

### New Database Tables

**`group_budgets`**:
```sql
CREATE TABLE public.group_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  tier TEXT NOT NULL CHECK (tier IN ('small', 'medium', 'large')),
  initial_credits INTEGER NOT NULL,
  remaining_credits INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id)
);

ALTER TABLE public.group_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip owner can manage group budget"
  ON public.group_budgets FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Collaborators can view group budget"
  ON public.group_budgets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trip_collaborators tc
    WHERE tc.trip_id = group_budgets.trip_id
      AND tc.user_id = auth.uid()
  ));
```

**`group_budget_transactions`**:
```sql
CREATE TABLE public.group_budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_budget_id UUID NOT NULL REFERENCES group_budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  credits_spent INTEGER NOT NULL,
  was_free BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.group_budget_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Budget participants can view transactions"
  ON public.group_budget_transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM group_budgets gb
    WHERE gb.id = group_budget_transactions.group_budget_id
      AND (gb.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM trip_collaborators tc
        WHERE tc.trip_id = gb.trip_id AND tc.user_id = auth.uid()
      ))
  ));
```

### Group Pricing (Credit-Based)

| Tier | Users | Credits | Shared Free Caps |
|------|-------|---------|------------------|
| Small | 2-3 | 150 | 10 swaps, 5 regens, 20 AI, 5 restaurant (40 total) |
| Medium | 4-8 | 300 | Same shared free caps |
| Large | 8+ | 500 | Same shared free caps |

### New Edge Functions

**`supabase/functions/purchase-group-unlock/index.ts`**:
1. Validate user balance >= tier credits
2. Deduct via FIFO from `credit_purchases`
3. Create `group_budgets` row
4. Log to `credit_ledger`
5. Return budget ID and balances

**`supabase/functions/topup-group-budget/index.ts`**:
1. Verify caller is budget owner
2. Deduct from owner's personal balance
3. Add to `group_budgets.remaining_credits`
4. Log transaction

**`supabase/functions/spend-group-credits/index.ts`**:
1. Check shared free caps via `trip_action_usage` (10/5/20/5 shared by all collaborators)
2. If beyond cap, deduct from `group_budgets.remaining_credits`
3. Log to `group_budget_transactions`
4. Return `GROUP_BUDGET_DEPLETED` if pool empty

### Frontend Changes

**`src/components/modals/GroupUnlockModal.tsx`**: Dual-path purchase (credits primary, Stripe fallback). Shows recommended tier based on collaborator count.

**`src/components/itinerary/GroupBudgetDisplay.tsx`**: Pool progress bar, recent transactions, top-up button for owner.

**`src/components/modals/GroupTopupModal.tsx`**: Preset amounts (50, 100, 200) with balance check.

### Routing: `spend-credits` vs `spend-group-credits`

In action handlers, check if trip has a `group_budgets` row. If yes, route to `spend-group-credits` instead of `spend-credits`.

### Transition

Keep existing Stripe `group_unlocks` path working for legacy rows. New purchases default to credit-based `group_budgets`. The collaborator logic in `spend-credits` (lines 214-273) continues reading `group_unlocks` for legacy rows.

---

## Phase E: Generation Gate Cleanup

### `useGenerationGate.ts`

Already clean -- first trip = free 2 days, else balance >= cost or LOCKED. No changes needed.

### `pricing.ts`

Update `GROUP_UNLOCK_TIERS` to include credit costs:

| Tier | Stripe Price | Credit Cost |
|------|-------------|-------------|
| Small | $19.99 | 150 credits |
| Medium | $34.99 | 300 credits |
| Large | $79.99 | 500 credits |

---

## File Summary

| File | Action | Phase |
|------|--------|-------|
| Database migration | Create `user_tiers`, `group_budgets`, `group_budget_transactions` | B, D |
| `supabase/functions/get-entitlements/index.ts` | Rewrite: add access gates, tier, caps, trip usage | A, B |
| `supabase/functions/spend-credits/index.ts` | Replace flat FREE_CAPS (lines 30-35) with tier-aware lookup | B |
| `supabase/functions/stripe-webhook/index.ts` | Add `user_tiers` upsert after credit fulfillment (~line 382) | B |
| `supabase/functions/generate-itinerary/index.ts` | Skip photo fetch for gated users | A |
| `supabase/functions/purchase-group-unlock/index.ts` | New edge function | D |
| `supabase/functions/topup-group-budget/index.ts` | New edge function | D |
| `supabase/functions/spend-group-credits/index.ts` | New edge function | D |
| `src/hooks/useEntitlements.ts` | Add new types, `canViewPremiumContentForDay` helper | A |
| `src/config/pricing.ts` | Update `FREE_ACTION_CAPS` to tier-based, add group credit costs | B, D |
| `src/components/itinerary/EditorialItinerary.tsx` | Gate photos/addresses/tips/reviews/booking per day | A, C |
| `src/components/itinerary/LockedPhotoPlaceholder.tsx` | New component | A |
| `src/components/itinerary/LockedField.tsx` | New component | A |
| `src/components/itinerary/FreeActionsCounter.tsx` | New component | C |
| `src/components/itinerary/GroupBudgetDisplay.tsx` | New component | D |
| `src/components/modals/OutOfFreeActionsModal.tsx` | New component | C |
| `src/components/modals/GroupUnlockModal.tsx` | Update with credit payment option | D |
| `src/components/modals/GroupTopupModal.tsx` | New component | D |

## Implementation Order

1. Database migration (user_tiers + group tables)
2. `get-entitlements` rewrite (Phase A + B backend)
3. `spend-credits` tier-aware caps (Phase B backend)
4. `stripe-webhook` tier upsert (Phase B backend)
5. `useEntitlements.ts` + `pricing.ts` frontend types (Phase A + B frontend)
6. `LockedPhotoPlaceholder` + `LockedField` components (Phase A frontend)
7. `EditorialItinerary.tsx` gating (Phase A frontend)
8. `FreeActionsCounter` + `OutOfFreeActionsModal` (Phase C)
9. Group edge functions + components (Phase D)
10. `generate-itinerary` photo skip (Phase A optimization)
