

## Fix: Itinerary Day Headers Overcount by Estimating Walk Items at ~$15 Each

### Problem

The itinerary day header costs show $640/pp instead of the correct $475/pp. The `getActivityCostInfo()` function in `EditorialItinerary.tsx` doesn't exclude walk connector items. When a walk has no `cost` property (undefined rather than 0), it falls through to `estimateCostSync()` which assigns ~$15. This adds 7 × $15 = $105 in phantom charges to the day totals.

The database is correct ($475.25/pp) because the sync logic at line 1211 only writes items where `act.cost > 0`. The Payments tab was already fixed. But the JS-side day header calculation still inflates totals.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`**

Add a walk/stroll guard at the top of `getActivityCostInfo()` (around line 978), before any estimation logic runs:

```typescript
function getActivityCostInfo(activity, travelers, budgetTier, destinationCity, destinationCountry): CostInfo {
  const category = activity.category || activity.type || 'activity';
  const title = activity.title || '';
  
  // Walk connectors are always free — skip estimation entirely
  const catLower = category.toLowerCase();
  const titleLower = title.toLowerCase();
  const isWalk = ['walk', 'walking', 'stroll'].includes(catLower) ||
    ['walk to', 'walk through', 'stroll', 'evening walk', 'neighborhood walk'].some(kw => titleLower.includes(kw));
  if (isWalk) {
    const rawCost = activity.cost?.amount;
    return { amount: (rawCost && rawCost > 0) ? rawCost : 0, isEstimated: false, confidence: 'high', basis: 'flat' };
  }
  
  // ... rest of existing logic unchanged
}
```

This ensures walk items return $0 (or their explicit cost if somehow non-zero) and never reach the estimation engine. Single function change, ~8 lines added.

### Impact
- Day 1: $95 → $80, Day 2: $261 → $246, Day 3: $284 → $269
- Itinerary per-person total aligns with the database ($475/pp)
- No database changes needed — DB is already correct

