

## Fix: Payments Tab Missing Food & Dining / Transit Items

### Problem
The Payments tab header shows the correct total ($5,918) from the financial snapshot, but the itemized list only totals $5,434. Food & Dining ($1,674) and Local Transit ($363) are entirely missing from the line items, creating a ~$484 gap (the exact gap depends on which activities happen to be categorized as dining/transit in `activity_costs` vs. parsed as "activity" in the JSON).

### Root Cause
Two different data sources:
- **Header total** → `useTripFinancialSnapshot` → reads from `activity_costs` DB table (includes all categories: dining, transit, activity, hotel, flight)
- **Itemized list** → `usePayableItems` → parses itinerary JSON activities and classifies them only as `flight`, `hotel`, or `activity`

The `usePayableItems` hook has `NEVER_FREE_CATEGORIES` that includes dining/transit keywords for cost estimation, but its output type system only supports `flight | hotel | activity`. All dining and transit items end up typed as `activity` — **if** they're matched at all. Many dining/transit items in `activity_costs` were synced during generation with specific categories but don't exist as individual activities in the itinerary JSON (they're budget allocations, not line items).

### Fix — 2 files

**1. `src/hooks/usePayableItems.ts`**

Add a new input: `activityCosts` (rows from the `activity_costs` DB table). After building items from itinerary JSON, compare against `activity_costs` to find categories with costs in the DB that have no matching payable items. For each unmatched category (e.g., "dining", "transit"), create a summary payable item:

```typescript
// After building items from itinerary JSON, add DB-only category items
if (activityCosts?.length) {
  const coveredCategories = new Set(['hotel', 'flight']); // already handled
  const jsonItemTotal = result.reduce((s, i) => s + i.amountCents, 0);
  
  // Group activity_costs by category, excluding hotel/flight (day_number=0)
  const categoryTotals = new Map<string, number>();
  activityCosts.forEach(cost => {
    if (cost.day_number === 0) return; // logistics handled separately
    const cat = cost.category || 'activity';
    const total = (cost.cost_per_person_usd || 0) * (cost.num_travelers || 1) * 100;
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + total);
  });
  
  // Add summary items for categories not covered by JSON-parsed items
  for (const [category, totalCents] of categoryTotals) {
    if (['dining', 'food'].includes(category) && totalCents > 0) {
      result.push({ id: `cat-dining`, type: 'activity', name: 'Food & Dining', amountCents: Math.round(totalCents), ... });
    }
    if (['transit', 'transport'].includes(category) && totalCents > 0) {
      result.push({ id: `cat-transit`, type: 'activity', name: 'Local Transit', amountCents: Math.round(totalCents), ... });
    }
  }
}
```

Expand the `PayableItemsInput` interface to accept an optional `activityCosts` array.

**2. `src/components/itinerary/PaymentsTab.tsx`**

Fetch `activity_costs` rows for the trip and pass them to `usePayableItems`:

```typescript
const { data: activityCosts } = useQuery({
  queryKey: ['activity-costs', tripId],
  queryFn: () => supabase.from('activity_costs').select('*').eq('trip_id', tripId).then(r => r.data),
});

const { items, totalCents, essentialItems, activityItems } = usePayableItems({
  days, flightSelection, hotelSelection, travelers, payments,
  budgetTier, destination, destinationCountry,
  activityCosts, // NEW
});
```

This ensures the Payments tab's itemized total matches the header total by surfacing all cost categories as trackable line items, while keeping the existing per-activity granularity for items that exist in both sources.

### Files
- `src/hooks/usePayableItems.ts` — accept `activityCosts` input, add summary items for DB-only categories
- `src/components/itinerary/PaymentsTab.tsx` — fetch and pass `activity_costs` to the hook

