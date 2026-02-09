
# Implementation Plan: Phases A + B + C (Feature Gating, Tier System, Free Actions UI)

## Overview

This rollout adds three interconnected capabilities:
- **Phase A**: Gate premium content (photos, addresses, tips, reviews, booking links, PDF) behind purchase status
- **Phase B**: Create a `user_tiers` table and make free action caps tier-aware
- **Phase C**: Add `FreeActionsCounter` and `OutOfFreeActionsModal` UI components

Group Unlocks stay on Stripe (Phase D skipped per margin analysis).

---

## Phase A: Feature Gating by Purchase Status

### What changes

Free users currently see everything on unlocked days. After this change, even on unlocked days, users who have **never purchased anything** will see locked placeholders for photos, addresses, insider tips, reviews, and booking links.

### Backend: `get-entitlements` edge function

Add a `hasCompletedPurchase` check by querying `credit_purchases` for any non-free rows:

```text
SELECT 1 FROM credit_purchases
WHERE user_id = $1
  AND credit_type NOT IN ('free_monthly', 'signup_bonus', 'referral_bonus')
LIMIT 1
```

Return new flags in the response:
- `has_completed_purchase: boolean`
- `can_view_photos: boolean` (= hasCompletedPurchase)
- `can_view_addresses: boolean`
- `can_view_booking_links: boolean`
- `can_view_tips: boolean`
- `can_view_reviews: boolean`
- `can_export_pdf: boolean`

### Frontend: `useEntitlements.ts`

Add new fields to `EntitlementsResponse` type:
- `has_completed_purchase`, `can_view_photos`, `can_view_addresses`, `can_view_booking_links`, `can_view_tips`, `can_view_reviews`, `can_export_pdf`

### Frontend: Activity card gating in `EditorialItinerary.tsx`

Currently, `isPreview` (per-day lock) already gates these elements. The new purchase-based gate applies independently:

- **Photos**: Update `shouldFetchRealPhoto` condition (line ~5755) to also require `can_view_photos` from entitlements. When false, show a `LockedPhotoPlaceholder`.
- **Addresses**: Lines ~5987 and ~6019 already check `!isPreview`. Add `&& canViewAddresses` check. When gated, show "Unlock to see address" with lock icon.
- **Tips/Insights**: Lines ~6042-6047 already check `!isPreview`. Add purchase gate. Show "Unlock to see insider tips" placeholder.
- **Reviews/Ratings**: Lines ~5914-5967 show rating badges and "See Reviews" buttons. Gate behind `can_view_reviews`. Show locked badge placeholder.
- **Booking links**: Lines ~6092-6126 show `InlineBookingActions`. Gate behind `can_view_booking_links`. Show "Unlock to book" placeholder.
- **PDF export**: Line ~2670 already partially gates this. Add `can_export_pdf` check.

### New components

1. **`LockedPhotoPlaceholder.tsx`** -- Gradient background with lock icon and "Upgrade to view photos" text. Used in activity card thumbnail area.
2. **`LockedField.tsx`** -- Compact inline component: icon + "Unlock to see [field]" + lock icon. Used for addresses, tips, reviews, booking links.

Both components include a subtle CTA linking to the pricing page.

### Entitlements flow through component tree

`EditorialItinerary` already calls `useEntitlements()` (line ~1036). The entitlements data will be passed down to `DaySection` and `ActivityRow` as a new `purchaseGates` prop (a simple object with the boolean flags), keeping the prop interface clean.

---

## Phase B: Tier System and Tier-Based Free Caps

### Database: Create `user_tiers` table

```sql
CREATE TABLE public.user_tiers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free',
  first_purchase_at TIMESTAMPTZ,
  highest_purchase TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tier"
  ON public.user_tiers FOR SELECT
  USING (auth.uid() = user_id);
```

### Backend: `stripe-webhook` update

After fulfilling a credit purchase, upsert into `user_tiers`:
- Determine tier from product (flex, voyager, explorer, adventurer)
- Only upgrade -- never downgrade (check if new tier is higher than current)

Tier hierarchy: `free < flex < voyager < explorer < adventurer`

### Backend: `spend-credits` update

Replace the flat `FREE_CAPS` constant with a tier-aware lookup:

```text
TIER_CAPS = {
  free:       { swap: 2,  regen: 1, ai: 4,  restaurant: 1 },
  flex:       { swap: 2,  regen: 1, ai: 4,  restaurant: 1 },
  voyager:    { swap: 4,  regen: 2, ai: 8,  restaurant: 2 },
  explorer:   { swap: 6,  regen: 3, ai: 12, restaurant: 3 },
  adventurer: { swap: 10, regen: 4, ai: 20, restaurant: 6 },
}
```

Before checking free caps, look up the user's tier from `user_tiers`. Fall back to `free` if no row exists.

**Important**: Current production caps are `10/5/20/5` (flat). The new Adventurer caps are `10/4/20/6` -- nearly identical. Lower tiers get reduced caps. This is a **breaking change for free/flex users** who currently enjoy 10 free swaps and will now get 2. Consider the user experience carefully -- the spec explicitly calls for this reduction.

### Backend: `get-entitlements` update

Return tier info:
- `tier: string`
- `free_caps: { swaps, regenerates, ai_messages, restaurant_recs }`
- `trip_usage: { swaps, regenerates, ai_messages, restaurant_recs }` (if tripId provided)
- `remaining_free_actions: { swaps, regenerates, ai_messages, restaurant_recs }`

This requires the edge function to accept an optional `tripId` query param and look up `trip_action_usage`.

---

## Phase C: Free Actions Counter and Out-of-Free-Actions Modal

### `FreeActionsCounter.tsx`

A compact component showing remaining free actions per trip. Displays:
- Swaps: X remaining
- Regenerates: X remaining
- AI messages: X remaining
- Restaurant recs: X remaining
- Club tier badge if applicable

Placed in the itinerary sidebar or day header area. Shows a warning state when all free actions are exhausted, with a CTA to buy credits.

### `OutOfFreeActionsModal.tsx`

Triggered when a user attempts a capped action after exhausting free uses. Different from `OutOfCreditsModal`:
- Title: "You've used your free [action]s"
- Shows cost of continuing (e.g., "5 credits per swap")
- If user can afford it: "Continue -- 5 credits" button
- If user cannot: "Get more credits" button linking to pricing

### Wiring into existing action handlers

The swap, regenerate, AI chat, and restaurant recommendation handlers already call `spend-credits`. The response includes `freeCapUsed`, `usageCount`, and `freeCap`. Use these to:
1. Update the `FreeActionsCounter` display after each action
2. Show `OutOfFreeActionsModal` when `freeCapUsed` transitions from `true` to `false` (user just crossed the cap boundary)

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/get-entitlements/index.ts` | Add purchase check, feature flags, tier lookup, trip usage |
| `supabase/functions/spend-credits/index.ts` | Replace flat FREE_CAPS with tier-aware lookup from user_tiers |
| `supabase/functions/stripe-webhook/index.ts` | Upsert user_tiers on purchase fulfillment |
| `src/hooks/useEntitlements.ts` | Add new types for feature gates, tier, caps |
| `src/components/itinerary/EditorialItinerary.tsx` | Pass purchase gates to ActivityRow, gate photos/addresses/tips/reviews/booking |
| `src/components/itinerary/LockedPhotoPlaceholder.tsx` | New component |
| `src/components/itinerary/LockedField.tsx` | New component |
| `src/components/itinerary/FreeActionsCounter.tsx` | New component |
| `src/components/modals/OutOfFreeActionsModal.tsx` | New component |
| Database migration | Create `user_tiers` table with RLS |

## Migration: user_tiers backfill

After creating the table, backfill existing users who have purchases:

```sql
INSERT INTO user_tiers (user_id, tier, first_purchase_at, highest_purchase, updated_at)
SELECT DISTINCT cp.user_id, 'flex', MIN(cp.created_at), 'flex', NOW()
FROM credit_purchases cp
WHERE cp.credit_type NOT IN ('free_monthly', 'signup_bonus', 'referral_bonus')
GROUP BY cp.user_id
ON CONFLICT (user_id) DO NOTHING;
```

Club tier backfills would need to be matched against Stripe product IDs -- handled manually or via a one-time script.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Free users lose 10 -> 2 free swaps suddenly | This is spec-intended. The reduced caps are the monetization lever. |
| `user_tiers` lookup adds latency to `spend-credits` | Single indexed PK lookup -- negligible |
| Existing users without tier row | Default to `free` tier caps |
| Photo gating breaks visual appeal for free users | Category-based static fallbacks already exist in `useActivityImage` -- these will show instead |
