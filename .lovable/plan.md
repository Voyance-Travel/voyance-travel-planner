

## Already Fixed — No Changes Needed

The bug you identified (`cities = isMultiCity ? [] : [destination]`) was already fixed in the previous round of changes. Here's the current code at lines 298-308:

```typescript
const tripCityNames = useMemo(() => {
  if (!isMultiCity) return [destination];
  if (tripCitiesData && tripCitiesData.length > 0) {
    return tripCitiesData.map(c => c.city_name).filter(Boolean) as string[];
  }
  return [destination]; // fallback
}, [isMultiCity, tripCitiesData, destination]);

const costEstimate = useMemo(() => {
  return calculateTripCredits({ days: totalDaysEstimate, cities: tripCityNames });
}, [totalDaysEstimate, tripCityNames]);
```

**ItineraryGenerator.tsx**: `tripCityNames` correctly pulls from `tripCitiesData` for multi-city trips, falling back to `[destination]`. The empty array bug is gone.

**useGenerationGate.ts**: Also already fixed — it builds `allCities` from journey sibling destinations and passes the full array to `calculateTripCredits`.

Both files were updated in the earlier "Fix multi-city generation + pricing" implementation. No further changes required.

