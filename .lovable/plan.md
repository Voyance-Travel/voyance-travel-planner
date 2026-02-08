

# Pricing Overhaul: Flexible Credits + Voyance Club

## Overview

Replace the current flat 4-pack credit system with a two-tier model:
- **Flexible Credits** (3 quick top-ups: 100/$9, 300/$25, 500/$39)
- **Voyance Club** (3 premium packs with bonus credits and perks: Voyager, Explorer, Adventurer)

## Step 1: Create Stripe Products & Prices

Create **3 new Stripe products** for Flexible Credits:
- Flexible 100 credits -- $9.00
- Flexible 300 credits -- $25.00
- Flexible 500 credits -- $39.00

Update existing Stripe products for the Club packs (reuse existing product IDs, create new prices):
- **Voyager** (reuse prod_TwRGf3nmLa70Ad "Weekend"): $29.99, 600 total credits (500 base + 100 bonus)
- **Explorer** (reuse prod_TwRGVa9L5UFQBt): $59.99, 1600 total credits (1200 base + 400 bonus)
- **Adventurer** (reuse prod_TwRGzFgQz5RIzr): $99.99, 3200 total credits (2500 base + 700 bonus)

## Step 2: Rewrite `src/config/pricing.ts`

Replace `CREDIT_PACKS`, `BOOST_PACK`, `TOPUP_PACK` with:

- `FLEXIBLE_CREDITS` array: 3 items (100/$9, 300/$25, 500/$39) with `expirationMonths: 12`
- `VOYANCE_CLUB_PACKS` array: 3 items (Voyager/Explorer/Adventurer) with `baseCredits`, `bonusCredits`, `totalCredits`, `perks[]`, `tier`, `expiresNever: true`, `bonusExpirationMonths: 6`
- `VOYANCE_CLUB_PERKS` config defining cumulative perks per tier
- Keep `CREDIT_PACKS` as a combined export for backward compatibility (`[...FLEXIBLE_CREDITS, ...VOYANCE_CLUB_PACKS]`)
- Update `BOOST_PACK` / `TOPUP_PACK` to point to the smallest flexible credit (100/$9)
- Update `getRecommendedPack` to search both arrays, preferring Club packs when value is better
- Update `ALL_CREDIT_PACKS` accordingly
- Update FAQ text constants if any are stored here

## Step 3: Rebuild Credit Packs section in `src/pages/Pricing.tsx`

Replace the current 4-card grid (lines 484-591) with two distinct sections:

**Section A -- "Quick Top-Up"**: Clean, compact rows showing the 3 flexible options. Simple "Buy" buttons. Subtext: "Buy exactly what you need. Credits expire in 12 months."

**Section B -- "Voyance Club"**: Three premium cards:
- **Voyager** ($29.99): "500 + 100 bonus = 600 credits" with perks: Club badge, Credits never expire
- **Explorer** ($59.99, "Popular" badge): "1,200 + 400 bonus = 1,600 credits" with perks: Everything in Voyager + Priority support + Early feature access
- **Adventurer** ($99.99, "Best Value"): "2,500 + 700 bonus = 3,200 credits" with perks: Everything in Explorer + Founding Member badge (X of 1,000 remaining) + Beta access

Replace the local `tiers` array (lines 37-67) with data driven from the new config. Remove the "Boost" upsell link at bottom. Update the monthly free credits callout to mention expiration differences.

## Step 4: Update `src/components/profile/CreditPacksGrid.tsx`

Restructure to show both tiers:
- Compact row/list for Flexible Credits at top
- Featured cards for Voyance Club packs below
- Remove the old "Quick boost" footer section (now part of Flexible Credits)

## Step 5: Update `src/components/home/PricingPreview.tsx`

Change the one-liner from "Start free. Unlock when ready. $24.99 per trip." to something like: "Start free. Top up from $9. Join the Voyance Club from $29.99."

## Step 6: Update `src/components/checkout/AddCreditsModal.tsx`

- Update `PRESET_AMOUNTS` from `[8, 12, 29, 55]` to `[9, 25, 39]`
- Update `BOOST_MINIMUM` from `$8` to `$9`

## Step 7: Update `src/lib/tripCostCalculator.ts`

Update `getRecommendedPackForEstimate` to search both `FLEXIBLE_CREDITS` and `VOYANCE_CLUB_PACKS`, recommending the best value option for the shortfall.

## Step 8: Update `src/components/checkout/UpgradePrompt.tsx`

Update pack references from old `CREDIT_PACKS[0]`, `CREDIT_PACKS[1]` index-based lookups to use the new named exports. Update the recommendation logic to work with both tiers.

## Step 9: Update `src/components/itinerary/CreditNudge.tsx`

Update `BOOST_PACK` references to use the new smallest flexible credit. Update recommendation logic for the two-tier system.

## Step 10: Update FAQ section in `src/pages/Pricing.tsx`

Update FAQ answers to reflect:
- Two ways to buy: Quick Top-Up (12-month expiry) vs Voyance Club (never expire + perks)
- Bonus credits expire in 6 months
- Club badge and perks explanation
- "Never expire" caveat (account must be active -- 1 login/year)

## Files Modified

| File | Change |
|------|--------|
| `src/config/pricing.ts` | Core pricing data restructure |
| `src/pages/Pricing.tsx` | Full credit packs section rebuild |
| `src/components/profile/CreditPacksGrid.tsx` | Two-tier layout |
| `src/components/home/PricingPreview.tsx` | Updated one-liner |
| `src/components/checkout/AddCreditsModal.tsx` | New presets |
| `src/components/checkout/UpgradePrompt.tsx` | Updated pack references |
| `src/components/itinerary/CreditNudge.tsx` | Updated pack references |
| `src/lib/tripCostCalculator.ts` | Updated recommendation logic |

## No Database Changes Required

The existing `credit_ledger` and `credit_balances` tables handle credits generically -- no schema changes needed. Badge display and Club membership tracking can be added as a future enhancement.

