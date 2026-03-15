

# Fix: Journey cost breakdown showing unequal prices for same-length legs

## Problem
In the Journey Cost Breakdown, Rome (4 days) shows 360 credits while Florence (4 days) shows 240 credits. Both should be 240. The multi-city fee (120 credits for 3 cities) is silently added to the first leg's cost at line 470, making it look like Rome costs more per day.

## Root Cause
**File: `src/components/itinerary/ItineraryGenerator.tsx`, line 470**
```typescript
breakdown[0].cost += multiCityFee; // Dumps 120cr multi-city fee into Rome's cost
```

## Fix
Stop adding the multi-city fee to the first leg. Instead, show it as a separate line item in the Journey Cost Breakdown UI, just like the single-trip breakdown already does.

### Change 1: Remove fee injection (line 468-471)
Remove `breakdown[0].cost += multiCityFee` and instead store the fee separately:
```typescript
const breakdown = allLegs.map(leg => { ... });
// Store multiCityFee for display, don't bake it into a leg
setJourneyMultiCityFee(multiCityFee);
setJourneyLegs(breakdown);
```

### Change 2: Add state for multi-city fee
Add a new state variable: `const [journeyMultiCityFee, setJourneyMultiCityFee] = useState(0);`

### Change 3: Update the Journey Cost Breakdown UI (~line 1012-1021)
After the per-leg rows, add a multi-city fee line before the separator:
```tsx
{journeyMultiCityFee > 0 && (
  <div className="flex justify-between text-muted-foreground">
    <span>Multi-city fee</span>
    <span>{formatCredits(journeyMultiCityFee)} credits</span>
  </div>
)}
```

### Change 4: Include fee in journey total (~line 1048)
Update the total calculation to include the fee:
```typescript
journeyLegs.reduce((sum, leg) => sum + leg.cost, 0) + journeyMultiCityFee
```

Same for `effectiveTotalCost` at line 988-989.

### Change 5: Reset fee when no journey
Set `setJourneyMultiCityFee(0)` alongside every `setJourneyLegs([])` call.

## Result
- Rome (4 days) → 240 credits
- Florence (4 days) → 240 credits  
- Venice (3 days) → 180 credits
- Multi-city fee → 120 credits
- Journey Total → 780 credits (same total, transparent breakdown)

| File | Change |
|------|--------|
| `src/components/itinerary/ItineraryGenerator.tsx` | Separate multi-city fee from leg costs; display as its own line item |

