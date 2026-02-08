
# Update Admin Margins Page for New Pricing Model

## Problem
The `src/pages/admin/UnitEconomics.tsx` page still references the old 5-tier pricing (Boost, Single, Weekend, Explorer, Adventurer) with outdated prices. It needs to reflect the new two-tier model: **Flexible Credits** (100/$9, 300/$25, 500/$39) and **Voyance Club** (Voyager $29.99, Explorer $59.99, Adventurer $99.99).

## Changes to `src/pages/admin/UnitEconomics.tsx`

### 1. Replace `CREDIT_TIERS` array (lines 199-264)

Replace the old 5-tier array with the new 6-tier structure (3 Flexible + 3 Club):

| Old Tier | New Tier | Price | Credits | Type |
|----------|----------|-------|---------|------|
| Boost $8.99 | Flex 100 | $9 | 100 | Flexible |
| Single $15.99 | Flex 300 | $25 | 300 | Flexible |
| Weekend $29.99 | Flex 500 | $39 | 500 | Flexible |
| Explorer $65.99 | Voyager | $29.99 | 600 | Club |
| Adventurer $99.99 | Explorer | $59.99 | 1,600 | Club |
| -- | Adventurer | $99.99 | 3,200 | Club |

Each entry keeps `typicalUsage`, `estimatedCostToUs`, and `notes` recalculated for the new credit amounts.

### 2. Update `FALLBACK_DATA.revenue` (line 64)

Replace:
```
{ boost: 8.99, single: 15.99, weekend: 29.99, explorer: 65.99, adventurer: 99.99 }
```
With:
```
{ flex_100: 9, flex_300: 25, flex_500: 39, voyager: 29.99, explorer: 59.99, adventurer: 99.99 }
```

### 3. Update `REVENUE_MIX_PRESETS` (lines 70-75)

Replace the 5-tier mix percentages (boost/single/weekend/explorer/adventurer) with 6-tier percentages (flex_100/flex_300/flex_500/voyager/explorer/adventurer). The presets model how revenue distributes across the new tiers:

- **Pessimistic**: Heavy flex buying, low club adoption
- **Conservative**: Moderate flex, growing club
- **Balanced**: Most revenue from Club (Voyager/Explorer)
- **Optimistic**: Heavy Explorer/Adventurer adoption

### 4. Update blended AOV calculation (lines 327-337)

Update the `useMemo` that computes `blendedAOV` and `blendedCostPerUser` to reference the 6 new tier keys instead of the old 5.

### 5. Update `verifiedMargins` (lines 722-738)

This maps over `CREDIT_TIERS` to show per-tier margin. Will automatically work once `CREDIT_TIERS` is updated, but verify the margin calculation still makes sense with Club packs (where bonus credits affect cost).

### 6. Update insights engine references (lines 706-717)

The "Boost tier" insight check references `CREDIT_TIERS.find(t => t.key === 'boost')`. Replace with a check for the smallest flexible pack (`flex_100`).

### 7. Update tier selector dropdown

The `tier` state and any dropdown/selector that lets admin pick a tier for single-tier analysis needs to show the new 6 options instead of the old 5.

### 8. Add Club vs Flexible distinction in margin table

Add a visual indicator (column or row grouping) in the per-tier margin table to distinguish Flexible Credits from Voyance Club packs, making it clear which tier type each row belongs to.

## No Other Files Changed

This is isolated to `src/pages/admin/UnitEconomics.tsx`. The new pricing config in `src/config/pricing.ts` is already correct and can be imported if desired, but the admin page uses its own internal cost modeling constants.
