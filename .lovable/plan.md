

## Remaining Gaps — Final Assessment

After reviewing the full codebase, all 12 compiler gaps (22F-22K) and the 3 integration gaps (22L-22N) are resolved. There is **one small wiring gap** remaining:

### Gap 16: `destinationHotel` Not Wired in compilerInput

**Location:** `supabase/functions/generate-itinerary/index.ts` lines 8097-8106

The `compilerInput` passes `isTransitionDay`, `transitionFrom/To`, `transitionMode`, and `transitionDepartureTime/ArrivalTime` — but **never passes `destinationHotel`**. The `dayCity` variable (from `multiCityDayMap`) has `hotelName` and `hotelAddress` for the destination city, but they are not mapped to the `destinationHotel` field.

**Impact:** On transition days, the constraint filler cannot fill the destination hotel check-in slot. The check-in slot stays empty and the AI has to guess the hotel — defeating the purpose of the pre-fill.

**Fix:** Add after line 8106 (after `transitionArrivalTime`):

```typescript
destinationHotel: resolvedIsTransitionDay && dayCity?.hotelName ? {
  name: dayCity.hotelName,
  address: dayCity.hotelAddress || '',
  checkInTime: undefined, // default 15:00 handled by constraint filler
} : undefined,
```

Where `dayCity` is `context.multiCityDayMap?.[dayNumber - 1]`. Need to verify this variable is in scope at line 8106.

### Verdict

This is the **only remaining gap**. Once this single line is added, the schema-driven generation system has 100% data parity with the existing pipeline. The system is ready for flag flip + testing.

### Proposed Fix: 22O — Wire destinationHotel

Single edit to `supabase/functions/generate-itinerary/index.ts`, adding `destinationHotel` to the compilerInput object using `dayCity?.hotelName` and `dayCity?.hotelAddress` from the existing multi-city day map.

