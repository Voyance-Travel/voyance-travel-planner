

## Fix: Breakfast Placeholder Injected on Last Day Due to Missing Departure Time in Save-Path Meal Guard

### Problem

The meal guard in two backend save paths calls `deriveMealPolicy()` without passing `departureTime24` or `arrivalTime24`. When the last day has `isLastDay: true` but no departure time, the policy defaults to `midday_departure` mode which **requires breakfast**. The guard then injects a placeholder "Breakfast at a café near your hotel".

The **generation** path correctly passes `context.flightData.departureTime24` (line 2001 of `index.ts`), so the AI doesn't generate the breakfast. But post-save guards re-run the policy without flight data and inject it.

**Affected files:**
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (line 221-226)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (line 662-667)

### Fix

Both files need to look up flight/departure data from the trip record (which is already fetched in both files) and pass it to `deriveMealPolicy`.

**1. `action-save-itinerary.ts`**

Before the meal guard loop (~line 210), extract departure/arrival times from the trip's `flight_selection` or `preferences` JSONB (already available in the function's trip data). Then pass `arrivalTime24` and `departureTime24` to `deriveMealPolicy`:

```typescript
const policy = deriveMealPolicy({
  dayNumber,
  totalDays,
  isFirstDay,
  isLastDay,
  arrivalTime24: isFirstDay ? (flightData?.arrivalTime24 || undefined) : undefined,
  departureTime24: isLastDay ? (flightData?.departureTime24 || flightData?.returnDepartureTime24 || undefined) : undefined,
});
```

**2. `action-generate-trip-day.ts`**

Same change at line 662-667. The function already has access to `flightContext` or the trip record. Pass the relevant times through.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/generate-itinerary/action-save-itinerary.ts` | Extract flight times from trip data, pass `arrivalTime24`/`departureTime24` to `deriveMealPolicy` in the meal guard loop |
| 2 | `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Same — pass flight times to `deriveMealPolicy` in the pre-save meal guard loop |

