

## Fix: Day Total Excludes Estimated ("~") Costs in Manual Mode

### Problem
`getDayTotalCost` on line 1178 skips any activity where `isEstimated === true`:
```typescript
return sum + (info.isEstimated ? 0 : info.amount);
```
This was designed so estimated costs don't inflate the "canonical" trip total. But in manual mode, all visible card costs (including estimated ones like "market browsing") should count toward the day total since they're the best data available and the user sees them on individual cards.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx` (line 1178)**

In manual mode, include all costs (estimated or not). Change:
```typescript
return sum + (info.isEstimated ? 0 : info.amount);
```
To:
```typescript
return sum + (isManualMode ? info.amount : (info.isEstimated ? 0 : info.amount));
```

Also update the call site at line 8932 to pass `isManualMode`:
```typescript
const totalCost = dayIsPreview ? 0 : getDayTotalCost(day.activities, travelers, budgetTier, destination, destinationCountry, isManualMode);
```

And the call at line 2978 similarly (needs `isManualMode` in scope there).

### Scope
1 file, ~3 lines changed.

