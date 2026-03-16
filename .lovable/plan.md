

## Fix: $1 Ledger Rounding Gap + $36 Day Badge Inflation

### Issue 1: $1 gap between "All Costs" item sum ($697) and Trip Expenses ($698)

**Root cause**: Each ledger row rounds independently (`Math.round(costPerPerson * numTravelers * 100)`), while the DB view `v_trip_total` sums exact floats then rounds once. With 38 rows, cumulative rounding error = $1.

**Fix**: In `getBudgetLedger` (tripBudgetService.ts), after mapping all rows, compute the rounding adjustment and apply it to the largest item so the displayed items always sum to the canonical total. This is a standard "largest remainder" correction:

```typescript
// After mapping all rows:
const rawSum = entries.reduce((s, e) => s + e.amount_cents, 0);
// Fetch canonical total from v_trip_total for comparison
// Apply +1/-1 cent adjustment to the largest entry if sums diverge
```

Alternatively (simpler): change the "All Costs" section header to show the count only (already does), and don't imply the items should sum to the Trip Expenses figure. The $698 total is already displayed from the snapshot — the per-item list is informational. **Recommendation**: Apply the largest-remainder adjustment for correctness.

### Issue 2: $36 gap — Day badges still inflated by walk/free-activity costs

**Root cause**: `isWalk` detection (line 998) only matches titles containing "walk to", "walk through", "stroll", "evening walk", "neighborhood walk". Activities like "Imperial Palace walk", "Ningyocho walk", "Senso-ji walk" don't match because they end with "walk" but don't contain any of those specific phrases.

These activities have `cost.amount > 0` set by the AI during generation, so `getActivityCostInfo` returns `isEstimated: false` (line 1017) and they're included in `getDayTotalCost`. But they're NOT in `activity_costs` (the canonical DB total), creating the $36 gap.

**Fix**: Expand the walk keyword detection in `getActivityCostInfo` (EditorialItinerary.tsx line 998) to catch any title where "walk" appears as a standalone word (not just specific phrases):

```typescript
const isWalk = ['walk', 'walking', 'stroll'].includes(catLower) ||
  /\bwalk\b|\bstroll\b|\bwalking\b/i.test(titleLower);
```

This catches "Imperial Palace walk", "Ningyocho walk", etc. while still allowing "walk to restaurant" to be caught. Walk activities return cost 0 (line 1002 — unless they have an explicit positive cost, which for free walks should be overridden to 0).

Actually, line 1001-1002 still returns the raw cost if positive: `(rawCost && rawCost > 0) ? rawCost : 0`. So even with the expanded detection, if the AI set cost=$35, it'd still show $35. **Additional fix**: For walks, always return 0 regardless of AI cost (walking is free):

```typescript
if (isWalk) {
  return { amount: 0, isEstimated: false, confidence: 'high', basis: 'flat' };
}
```

### Files to change

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Expand `isWalk` regex (line 998) to `\bwalk\b` pattern; force walk cost to 0 |
| `src/services/tripBudgetService.ts` | In `getBudgetLedger`, apply largest-remainder rounding adjustment so item sum matches `v_trip_total` |

### Expected outcome
- "All Costs" items sum to exactly $698 (matches Trip Expenses)
- Day badges exclude walk activities, reducing the $36 inflation
- Day 1 + Day 2 + Day 3 + Day 4 totals align with the canonical Trip Total

