

## Fix Transit Activities All Showing Same Cost

### Problem
Every transport activity shows the same cost (e.g., $30 in NYC) because `estimateCostSync()` maps all transport to a single `transport_base_usd` field, and `isNeverFreeCategory()` forces estimation even when the AI correctly returns $0 for walking/public transit.

### Changes

**1. Mode-aware transport estimation — `src/lib/cost-estimation.ts` (line ~396)**

After `baseField` is determined, add a transport-specific early return that infers mode from the title and uses realistic base costs:
- Walking/stroll → $0
- Subway/metro/bus/tram → $3 base
- Train/rail → $5 base
- Ferry/boat → $8 base
- Taxi/cab → $20 base
- Uber/rideshare → $18 base
- Shuttle/airport bus → $12 base
- Private car → $40 base
- Generic → $5 base

Cap the city cost multiplier at 1.3 for public transit (fares don't scale like restaurant prices). Round to nearest $1 instead of $5.

**2. Remove public transit from never-free keywords — `src/components/itinerary/EditorialItinerary.tsx` (line ~997-1001)**

Remove `'train to'` and `'bus to'` from `neverFreeKeywords`. Keep taxi, uber, shuttle, airport, private car (genuinely never free).

**3. AI prompt improvements — `supabase/functions/generate-itinerary/index.ts`**

At line 9510, add mode-specific pricing guidance after the existing transit instruction:
- Walking = $0, Subway/Metro/Bus = actual local fare ($2-5), Taxi = distance-based ($10-40)
- Title must include mode: "Travel to [place] via [mode]"

At line 9670, update the CRITICAL REMINDERS transit instruction to include realistic per-mode costs.

**4. Transport-specific rounding — `src/components/itinerary/EditorialItinerary.tsx` (line ~959)**

Change `estimateCostByCategory` to round transport to nearest $1 instead of $5:
```typescript
const isTransportCategory = ['transportation', 'transport', 'transfer'].includes(cat);
return isTransportCategory
  ? Math.round(total)
  : Math.round(total / 5) * 5;
```

### Files changed

| File | Change |
|------|--------|
| `src/lib/cost-estimation.ts` | Add mode-aware transport pricing with capped multiplier |
| `src/components/itinerary/EditorialItinerary.tsx` | Remove public transit from never-free list; transport rounding to $1 |
| `supabase/functions/generate-itinerary/index.ts` | Add per-mode transport pricing guidance to AI prompt |

