
# Dashboard Update: Align Unit Economics with New Pricing Model

## Summary

Update `UnitEconomics.tsx` and `useUnitEconomicsData.ts` to reflect the tier-based free caps, credit-pool group unlocks, and add new analytics sections for tier distribution and group budget health.

---

## Changes by File

### 1. `src/hooks/useUnitEconomicsData.ts`

**Add to types (after line 136):**
- `tierDistribution`: array of `{ tier, count, upgradedThisMonth }` from `user_tiers`
- `groupBudgets`: `{ pools: [{ tier, count, allocated, remaining, depleted }], totalPools }` from `group_budgets`

**Add two parallel queries (line 207, extend the `Promise.all`):**
- `supabase.from('user_tiers').select('tier, updated_at')` -- process client-side to count by tier and recent upgrades
- `supabase.from('group_budgets').select('tier, initial_credits, remaining_credits')` -- aggregate by tier

**Process results:** Group the raw rows into the typed aggregates. Add to the returned object alongside existing fields.

---

### 2. `src/pages/admin/UnitEconomics.tsx`

#### A. Fix comment (line 198)
Change `Free caps per trip: swap 10, regen 5, ai_message 20, restaurant 5` to `Free caps per trip (tier-based): swap 3-15, regen 1-5, ai_message 5-25, restaurant 1-5`

#### B. Fix CREDIT_TIERS group entries (lines 287-323)
Replace the three group entries with credit-pool model:

| Field | Old | New |
|-------|-----|-----|
| `price` | 19.99 / 34.99 / 79.99 | 0 (no Stripe price) |
| `credits` | 0 | 150 / 300 / 500 |
| `type` | `"addon"` | `"group"` |
| `estimatedCostToUs` | 0.015 | 0.50 / 1.00 / 1.50 |
| `description` | "Group unlock - small..." | "Credit pool (2-3 travelers)" |
| `notes` | "Fixed price product..." | "150 credit pool. 40 shared free actions..." |

Add new fields: `sharedFreeCaps: 40`, `typicalPaidActions: 20 / 50 / 90`.

#### C. Fix ACTION_COSTS group entries (lines 339-342)
Update `purchase_group_small` to 0.50, `purchase_group_medium` to 1.00, `purchase_group_large` to 1.50 (reflecting pool utilization cost, not just setup).

#### D. Fix FALLBACK_DATA.revenue (line 64)
Remove `group_small`, `group_medium`, `group_large` from revenue object (groups no longer generate direct Stripe revenue).

#### E. Fix REVENUE_MIX_PRESETS (lines 70-75)
Remove group tiers from all presets. Percentages only cover flex + club tiers. Renormalize so existing tiers sum to 100%.

#### F. Fix blendedAOV calculation (lines 399-410)
Remove group references from the AOV calculation (they no longer contribute to Stripe revenue).

#### G. Fix Action Cost Table rows (lines 1966-1976)
- Change free cap values: `"10/trip"` to `"3-15/trip*"`, `"5/trip"` to `"1-5/trip*"`, `"20/trip"` to `"5-25/trip*"`
- Replace group rows from fixed-price model to credit-based:
  - `credits: 150 / 300 / 500` (not null)
  - `cost: 0.50 / 1.00 / 1.50`
  - Remove `fixedPrice` field

#### H. Fix Action Cost Table group column rendering (lines 2006-2021)
Remove the `isFixedPrice` branch (no longer needed since groups have credits). Remove the `t.credits === 0` "N/A" branch (groups now have credits > 0).

#### I. Fix footer note (lines 2041-2044)
Replace text with: "Each cell shows user pays + margin % at that tier's $/credit rate. *Free caps vary by tier: Free/Flex (3/1/5/1 = 10 total), Voyager (6/2/10/2 = 20), Explorer (9/3/15/3 = 30), Adventurer (15/5/25/5 = 50). Free/Flex caps scale with trip length. Group pools share 40 free actions before pool credits are deducted."

#### J. Fix Tier -> Usage Pattern table (lines 2066-2178)
- Change group header from `'Add-on Products'` to `'Group Unlock (Credit Pool)'`
- For group rows: show "150 cr" / "300 cr" / "500 cr" in Price column instead of "$19.99"
- Replace "Swaps" / "Regens" columns with "Free Acts" / "Pool Usage" for group rows
- Add "Free Acts" column showing tier-based totals for flex/club rows (10, 10, 20, 30, 50)
- Free user rows: add "10/trip" in Free Acts column

#### K. Add Tier Distribution section (after line 2217, before Monthly Expense Projections)
New collapsible section using `econData.tierDistribution`:
- Table: Tier | Users | % | Upgraded This Month
- Group credit value insight: `groupCreditsAllocated * $0.09`
- Uses same dark panel style as existing sections

#### L. Add Group Budget Analytics section (after Tier Distribution)
New collapsible section using `econData.groupBudgets`:
- Table: Tier | Pools | Allocated | Remaining | Utilization % | Depleted
- Pool health indicators (healthy/low/depleted counts)
- Total summary row

#### M. Update insights engine (lines 646-793)
Add three new insights:
1. **Group pool depletion warning**: If any `groupBudgets.pools` have `depleted > 0`, emit warning with count
2. **Group credit absorption**: Show total credits allocated to pools as dollar equivalent (`allocated * $0.09`)
3. **Tier margin check**: Confirm all tiers maintain >90% margin (success insight)

---

## Implementation Order

1. `useUnitEconomicsData.ts` -- add queries + types (~60 lines)
2. `UnitEconomics.tsx` constants -- fix CREDIT_TIERS, ACTION_COSTS, REVENUE_MIX, comment (items A-F)
3. `UnitEconomics.tsx` Action Cost Table -- fix rows, rendering, footer (items G-I)
4. `UnitEconomics.tsx` Tier Usage Table -- fix group rows, add columns (item J)
5. `UnitEconomics.tsx` new sections -- Tier Distribution, Group Budgets (items K-L)
6. `UnitEconomics.tsx` insights -- add new entries (item M)

## What Does NOT Change

- Cost Model constants (lines 30-46) -- still accurate
- FREE_USER_ECONOMICS (lines 121-161) -- still accurate
- Monthly Expense Projections table -- still accurate
- Revenue Drilldown section -- still shows actual Stripe data correctly
- Daily metrics time series -- still accurate
- Scenario toggle logic -- still valid
