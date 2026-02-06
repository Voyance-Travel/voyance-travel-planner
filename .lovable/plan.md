
# Voyance Credit System Overhaul - Implementation Plan

## Overview

Migrate from flat per-action credit costs (150/day unlock) to a dynamic formula-based model where trip cost = `roundUpTo10((Days x 90 + MultiCityFee) x TierMultiplier) + AddOns`. This touches pricing config, edge functions, database triggers, Stripe products, and multiple UI components.

## What's Changing

### Credit Costs (Old vs New)

| Action | Old | New |
|--------|-----|-----|
| Trip generation | 150/day (UNLOCK_DAY) | Formula: (Days x 90 + MultiCityFee) x Multiplier |
| Activity swap | 10 | 15 |
| Day regeneration | 20 | 90 |
| Hotel search | N/A | 40/city (new) |
| Restaurant rec | 15 | Removed |
| AI message | 10 | Removed |
| PDF export | 0 | 0 (no change) |

### Package Changes

| Pack | Old Price | Old Credits | New Price | New Credits |
|------|-----------|-------------|-----------|-------------|
| Boost | $8.99 | 80 | $8.99 | 100 |
| Starter | $15.99 | 200 | $15.99 | 200 (no change) |
| Weekend | $29.99 | 500 | $29.99 | 500 (no change) |
| Explorer | $59.99 | 1,200 | $65.99 | 1,200 |
| Adventurer | $99.99 | 2,500 | $99.99 | 2,500 (no change) |

### Signup Bonus

| | Old | New |
|--|-----|-----|
| Signup bonus | 500 credits | 150 credits |
| Expiration | 6 months | 2 months |

---

## Preserved Sections (User Request)

The following sections of the current Pricing page will be **kept as-is** (with minor content updates):
- "Everything included with credits" (12-feature grid with icons and descriptions)
- "Every day includes" (6-item whatsInADay grid)
- Pack description cards with breakdown options and examples
- Sample day preview (Tokyo)
- Guarantee section
- Bottom CTA

---

## Implementation Phases (Ordered to Avoid Breakage)

### Phase 1: Create New Stripe Prices

Before any code changes, create two new Stripe prices:
1. **Boost**: $8.99 for 100 credits (replaces 80-credit Boost)
2. **Explorer**: $65.99 for 1,200 credits (replaces $59.99 Explorer)

Record the new Price IDs for use in Phase 2.

### Phase 2: Shared Logic and Config

**New file: `src/lib/tripCostCalculator.ts`**
- `calculateComplexity(dna, tripParams)` -- returns tier, multiplier, factors array
- `calculateMultiCityFee(cityCount)` -- returns 0/60/120/180
- `calculateTripCredits(days, cities, dna, tripParams, includeHotels)` -- returns full estimate breakdown
- `getRecommendedPackForEstimate(creditsNeeded, currentBalance)` -- suggests best pack
- `roundUpTo10(n)` -- rounding helper
- Pure functions, no side effects, importable by both frontend and referenced conceptually by edge functions

**Update: `src/config/pricing.ts`**
- Replace `CREDIT_COSTS` object: remove `UNLOCK_DAY`, `RESTAURANT_REC`, `AI_MESSAGE`; add `TRIP_GENERATION` (variable), `HOTEL_SEARCH` (40), update `SWAP_ACTIVITY` (15), `REGENERATE_DAY` (90)
- Add constants: `BASE_RATE_PER_DAY = 90`, `MULTI_CITY_FEES = {1: 0, 2: 60, 3: 120, 4: 180}`, `COMPLEXITY_TIERS`
- Update `STRIPE_PRODUCTS.CREDITS_80` to 100 credits with new Price ID
- Update `STRIPE_PRODUCTS.CREDITS_1200` to $65.99 with new Price ID
- Update `FREE_TIER.signupBonus` from 500 to 150; `freeExpirationMonths` stays at 2
- Update `CREDIT_PACKS` and `BOOST_PACK` arrays accordingly
- Rewrite `TRIP_COST_EXAMPLES` with formula-based examples (Paris 3-day 270, Tokyo 5-day 450, etc.)

### Phase 3: Database Changes

**Migration 1: Create `trip_complexity` table**
```text
trip_complexity
  trip_id UUID PRIMARY KEY (FK -> trips.id)
  factor_count INTEGER NOT NULL
  tier TEXT NOT NULL ('standard' | 'custom' | 'highly_curated')
  multiplier NUMERIC(3,2) NOT NULL
  factors JSONB NOT NULL
  base_credits INTEGER NOT NULL
  multi_city_fee INTEGER NOT NULL
  total_credits INTEGER NOT NULL
  created_at TIMESTAMPTZ DEFAULT now()
```
- RLS policy: users can read their own trip complexity via trip ownership

**Migration 2: Update `handle_new_user()` function**
- Change signup bonus from 500 to 150 free credits
- Change expiration from 6 months to 2 months
- Update ledger note to "Welcome bonus - 150 free credits"

### Phase 4: Backend Edge Functions

**Update: `supabase/functions/spend-credits/index.ts`**
- Replace `CREDIT_COSTS` map:
  - Remove `unlock_day` (replaced by `trip_generation`)
  - Add `trip_generation` as variable-cost action (accepts `creditsAmount` in request body, validates server-side)
  - Add `hotel_search` as variable-cost action (40 x cityCount)
  - Update `swap_activity` to 15
  - Update `regenerate_day` to 90
  - Remove `restaurant_rec` and `ai_message`
- For variable-cost actions, accept and validate a `creditsAmount` field
- Store complexity breakdown in ledger metadata

**Update: `supabase/functions/get-entitlements/index.ts`**
- Update `CREDIT_COSTS` references used for feature flags (lines ~245-250)
- Replace `build_full_trip` / `build_day` with new trip-generation logic

### Phase 5: Frontend Hooks

**Update: `src/hooks/useSpendCredits.ts`**
- Update `ACTION_MAP`: remove `UNLOCK_DAY`, add `TRIP_GENERATION`, `HOTEL_SEARCH`
- Support passing `creditsAmount` in request body for variable-cost actions

**Update: `src/hooks/useFreeTierLimits.ts`**
- Remove `canUnlockDay` and `daysAffordable` (no longer flat per-day)
- Remove `canGetRestaurantRec` and `canSendAiMessage`
- Update `canSwapActivity` threshold to 15, `canRegenerateDay` to 90
- Add `canAffordTrip(estimate: number)` or keep generic `needsCredits` based on minimum action cost

**Update: `src/hooks/useDraftLimitCheck.ts`**
- Remove all `CREDIT_COSTS.UNLOCK_DAY` references
- Replace with estimate-aware messaging (e.g., "Your trip costs X credits")

**New: `src/hooks/useTripEstimate.ts`**
- Takes trip params (days, cities, DNA profile) and returns full credit estimate
- Uses `calculateTripCredits` from shared calculator
- Provides `canAfford`, `creditsNeeded`, `recommendedPack`

### Phase 6: Frontend UI Components

**Update: `src/pages/Pricing.tsx`**
- Update `tiers` array: Boost credits 80 -> 100, Explorer price $55 -> $65.99
- Update tier descriptions to use formula language ("~2 days" instead of "1 full day")
- Add "What Do Credits Cover?" section: base rate (90/day), multi-city fees, complexity tiers, add-ons table
- Add "Example Trip Costs" table (Paris 3-day 270, Tokyo->Kyoto 7-day 690, etc.)
- Add complexity tier explainer with "Accessibility is always free" messaging
- Update FAQs to reflect formula-based pricing
- **Keep**: "Everything included with credits" grid, "Every day includes" grid, sample day preview, guarantee, bottom CTA

**Update: `src/components/checkout/UpgradePrompt.tsx`**
- Remove `unlock_day` context option
- Add `trip_generation` and `hotel_search` contexts
- Update `ACTION_LABELS` with new costs (swap 15, regenerate 90, remove restaurant/ai_message)
- Support dynamic `creditsNeeded` display for variable-cost actions
- Update Boost display from "80 credits" to "100 credits"

**Update: `src/components/common/DraftLimitBanner.tsx`**
- Remove `CREDIT_COSTS.UNLOCK_DAY` references
- Base low-credit threshold on minimum useful action (e.g., swap at 15 credits)
- Update messaging from "unlock a day" to "generate a trip"

**Update: `src/components/itinerary/EditorialItinerary.tsx`**
- Swap cost references auto-update from `CREDIT_COSTS.SWAP_ACTIVITY` (now 15)
- Regenerate cost references auto-update from `CREDIT_COSTS.REGENERATE_DAY` (now 90)
- These read from the config so they update automatically

**Update: `src/components/itinerary/ItineraryAssistant.tsx`**
- Remove AI message credit check (AI messages no longer cost credits, or remove gating entirely)

### Phase 7: Admin/Internal Config

**Update: `src/config/unitEconomics.ts`**
- Update `CREDIT_ACTION_MAPPING` with new credit values
- Update `REVENUE_CONFIG.creditPacks` with new prices
- Update `freeTier.signupBonus` to 150

**Update: `src/config/userLifecycleCosts.ts`**
- Update `CREDIT_TO_COST_MAPPING` with new credit values and actions
- Add `trip_generation` and `hotel_search` entries
- Remove `restaurant_rec` and `ai_message`

### Phase 8: Migration for Existing Users

**Database migration**: Grant 150 free credits to all existing users who have 0 balance
- One-time script via migration SQL
- Does not affect users who already have purchased credits

---

## Complete File Impact List

| File | Change |
|------|--------|
| `src/config/pricing.ts` | Major rewrite of costs, packages, free tier |
| `src/lib/tripCostCalculator.ts` | **New file** - shared calculation logic |
| `src/hooks/useTripEstimate.ts` | **New file** - trip cost estimation hook |
| `src/hooks/useSpendCredits.ts` | Update action map, add variable-cost support |
| `src/hooks/useFreeTierLimits.ts` | Remove UNLOCK_DAY, update thresholds |
| `src/hooks/useDraftLimitCheck.ts` | Remove UNLOCK_DAY references |
| `src/pages/Pricing.tsx` | Update tiers, add cost table, update FAQs |
| `src/components/checkout/UpgradePrompt.tsx` | New contexts, updated costs |
| `src/components/common/DraftLimitBanner.tsx` | Remove UNLOCK_DAY references |
| `src/components/itinerary/EditorialItinerary.tsx` | Costs auto-update from config |
| `src/components/itinerary/ItineraryAssistant.tsx` | Remove AI message credit gate |
| `src/config/unitEconomics.ts` | Update credit action mapping |
| `src/config/userLifecycleCosts.ts` | Update credit cost mapping |
| `supabase/functions/spend-credits/index.ts` | Major update - new actions, variable costs |
| `supabase/functions/get-entitlements/index.ts` | Update feature flag credit checks |
| DB: `handle_new_user()` | 500 -> 150 signup bonus, 6mo -> 2mo expiry |
| DB: `trip_complexity` table | New table with RLS |

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| User has exactly enough credits | Allow, show "0 remaining" |
| User has 0 credits | Show purchase options only |
| Mid-generation failure | Refund credits automatically |
| 21+ day trip | Same formula, no cap |
| 6+ city trip | Multi-city fee capped at 180 |
| 10+ complexity factors | Multiplier capped at 1.30x |
| Existing users with old balance | Keep current balance, no disruption |

## Implementation Order (Critical Path)

1. Create Stripe prices (Boost 100, Explorer $65.99)
2. Create `src/lib/tripCostCalculator.ts` (safe - new file, no imports yet)
3. Update `src/config/pricing.ts` (all downstream reads from here)
4. Database migrations (trip_complexity table + handle_new_user update)
5. Update `spend-credits` edge function + deploy
6. Update frontend hooks (useSpendCredits, useFreeTierLimits, useDraftLimitCheck)
7. Create `useTripEstimate` hook
8. Update UI components (Pricing page, UpgradePrompt, DraftLimitBanner)
9. Update admin configs (unitEconomics, userLifecycleCosts)
10. Test end-to-end: signup flow, trip generation, swaps, regeneration, purchases
