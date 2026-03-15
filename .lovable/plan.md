# Fix: Airport transfer activities appearing on non-flight departure days

## Problem

On the last day of an intermediate city (e.g., leaving Rome for Venice by train), the AI generates a "Taxi to Airport" activity even though the prompt says "DO NOT mention airports." 

&nbsp;

"The "Train to Venice" departure card is correctly injected by the UI, but the erroneous AI-generated airport transfer activity sits alongside it, creating a contradictory itinerary." I am not seeing this. I want to see another train to Venice card in the iteneary with the address of the train station and a trasnport card from the hotel to the station. This is an example but it should be like this for whatever mode of transportaion is taken 

## Root Cause

The post-processing in `generate-itinerary/index.ts` has two airport-related cleanup passes (sequence fix at ~line 2478 and dedup at ~line 2551), but both are gated by `isLastDay` — the **absolute** last day of the entire trip. Intermediate city departure days (`paramIsLastDayInCity && !isLastDay`) have no post-processing to strip airport references when the next leg is NOT a flight.

## Fix

### 1. Add post-processing strip for non-flight departure days

**File: `supabase/functions/generate-itinerary/index.ts**`

After the existing departure day sequence fix (~line 2545), add a new block for the `generate-day` path AND the full-generation path:

```
// NON-FLIGHT DEPARTURE DAY: Strip airport activities when next leg is train/bus/car/ferry
if (paramIsLastDayInCity && !isLastDay && resolvedNextLegTransport && resolvedNextLegTransport !== 'flight') {
  const beforeCount = generatedDay.activities.length;
  generatedDay.activities = generatedDay.activities.filter(a => {
    const t = (a.title || '').toLowerCase();
    const isAirportRef = 
      t.includes('airport') || 
      t.includes('taxi to airport') ||
      t.includes('transfer to airport') ||
      t.includes('departure transfer') ||
      t.includes('flight departure');
    return !isAirportRef;
  });
  const removed = beforeCount - generatedDay.activities.length;
  if (removed > 0) {
    console.log(`[Stage 2] Day ${dayNumber}: Stripped ${removed} airport activities (next leg is ${resolvedNextLegTransport}, not flight)`);
  }
}
```

### 2. Same guard in the `generate-day` action path

**File: `supabase/functions/generate-itinerary/index.ts**`

In the `generate-day` handler (around the checkout guarantee section ~line 9876), add the same strip before returning the response. The variables `paramIsLastDayInCity`, `isLastDay`, and `resolvedNextLegTransport` are already in scope.

### Files Changed


| File                                             | Change                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/generate-itinerary/index.ts` | Add airport activity strip for non-flight intermediate departure days in both full-gen and generate-day paths |
