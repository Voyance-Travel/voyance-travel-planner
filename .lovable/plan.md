

## Fix: Trip Total on Itinerary Tab Diverges from Budget Tab

### Problem
Itinerary tab shows $6,749, Budget tab shows $5,918. Three different hotel figures floating around simultaneously.

### Root Cause
Line 3025 in `EditorialItinerary.tsx`:
```typescript
const totalCost = snapshotTotalUsd > 0
  ? snapshotTotalUsd
  : jsTotalCost * (travelers || 1); // Fallback
```

The fallback path (`jsTotalCost * travelers`) is flawed:
- `jsTotalCost = totalActivityCost + flightCost + hotelCost`
- `totalActivityCost` is **per-person**, `hotelCost` is **per-room (total)**
- Multiplying everything by `travelers` **double-counts the hotel** (and potentially flight)
- The hotel cost calculation at lines 2999-3017 reads from local JSON (which may have stale/different values than `activity_costs` DB)

When the snapshot hasn't loaded yet or returns 0 momentarily, the Itinerary tab falls through to this broken JS formula, producing a number that matches neither the Budget nor Payments tabs.

Even when the snapshot IS used, there's a **race condition**: the component renders once with `snapshotTotalUsd = 0` (loading), displays the JS fallback, then re-renders with the snapshot. The user may see the wrong number flash or get cached.

### Fix — 1 file

**`src/components/itinerary/EditorialItinerary.tsx`** (~line 3020-3027)

1. **Show a loading state instead of the broken fallback** — when the snapshot is loading, don't display `jsTotalCost * travelers`. Show the snapshot value or a placeholder.

2. **Fix the fallback formula** for the brief moment before snapshot loads — hotel and flight costs should NOT be multiplied by travelers:

```typescript
const perPersonCosts = totalActivityCost;
const fixedCosts = flightCost + hotelCost; // per-room/per-booking, not per-person
const jsTotalCost = perPersonCosts * (travelers || 1) + fixedCosts;
const totalCost = snapshotTotalUsd > 0 ? snapshotTotalUsd : jsTotalCost;
```

This ensures the fallback at least produces a reasonable number while the snapshot loads, and the snapshot (same DB source as Budget tab) is used for the final display.

### Files
- `src/components/itinerary/EditorialItinerary.tsx` — fix fallback formula so hotel/flight aren't multiplied by travelers

