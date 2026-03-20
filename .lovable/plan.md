

## Fix: Transport segment header shows wrong cost from estimation engine

### Problem

Transport activities like "Evening Descent to the Seine" pass through `getActivityCostInfo`, which runs the general cost estimation engine. Because the title sounds like a sightseeing activity, it estimates ~€28. This cost is then displayed in the `TransitModePicker` header. Meanwhile, the actual transport mode costs (€3 metro, €2 bus, etc.) come from the `airport-transfers` edge function and are shown only when expanded — creating a visible mismatch.

### Root cause

In `EditorialItinerary.tsx` line 9912:
```typescript
const transportCost = isWalkingTransport ? null : (cost > 0 ? cost : null);
```

`cost` comes from `getActivityCostInfo` (line 9662-9663), which doesn't distinguish transport activities from dining/sightseeing. It feeds the title into the estimation engine, which returns an irrelevant estimate.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx` (~line 9910-9912)**

Replace the transport cost derivation to use the activity's actual `transportation.estimatedCost` data (which comes from route data) instead of the general estimation engine. If no transport-specific cost exists, show nothing rather than a misleading estimate.

```typescript
// Use transport-specific cost from route data, NOT the general estimation engine
const transportEstCost = activity.transportation?.estimatedCost?.amount;
const transportCost = isWalkingTransport ? null
  : (transportEstCost && transportEstCost > 0 ? transportEstCost : null);
```

This ensures the header cost matches what the expanded modes show, and displays nothing when no real transport cost is available.

### Scope
Single line change in `src/components/itinerary/EditorialItinerary.tsx`.

