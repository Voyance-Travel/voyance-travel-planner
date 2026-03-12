

## Fix: `ReferenceError: multiCityDayMap is not defined` Crashing All Generation

### Root Cause

The edge function logs show the exact error:
```
ReferenceError: multiCityDayMap is not defined
    at index.ts:8145
```

In the schema path (lines 8090+), two variables are referenced as bare names instead of through the `context` object:

- **Line 8284**: `multiCityDayMap?.[dayNumber - 1]` — should be `context.multiCityDayMap?.[dayNumber - 1]`
- **Line 8286**: `firstTimePerCity?.[resolvedDestination]` — should be `context.firstTimePerCity?.[resolvedDestination]`
- **Line 8821**: `multiCityDayMap?.[dayNumber - 1]` — should be `context.multiCityDayMap?.[dayNumber - 1]`

These were likely introduced during the Gap 2 (hotel address correction) and multi-city context porting. The `ReferenceError` crashes the entire day generation — even for single-city trips — because JavaScript throws before optional chaining can return `undefined`.

### Fix

3 line-level replacements in `supabase/functions/generate-itinerary/index.ts`:

1. **Line 8284**: `multiCityDayMap?.` → `context.multiCityDayMap?.`
2. **Line 8286**: `firstTimePerCity?.` → `context.firstTimePerCity?.`
3. **Line 8821**: `multiCityDayMap?.` → `context.multiCityDayMap?.`

### Files Changed: 1
- `supabase/functions/generate-itinerary/index.ts` — prefix 3 bare variable references with `context.`

