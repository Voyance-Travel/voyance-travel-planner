

# Fix: Airport activity stripping is dead code in full-gen path

## Problem
The "Transfer to Fiumicino Airport (FCO)" activity appears on Rome's last day even though the next leg is a train to Florence. The AI prompt correctly says "DO NOT mention airports" but the AI still generates airport activities. The post-processing strip at line 2581 that should catch these is **dead code** — it references `paramIsLastDayInCity` and `resolvedNextLegTransport`, which are only defined in the generate-day handler (line 6558), not in the `generateSingleDayWithRetry` function used by the full-gen path.

## Root Cause
`generateSingleDayWithRetry` (line 1465) doesn't receive or compute `paramIsLastDayInCity` or `resolvedNextLegTransport`. These variables are undefined in its scope, so the `if` at line 2581 always evaluates to false. The prompt tells the AI not to generate airport references (line 1926), but the AI ignores it — and the safety net strip never fires.

## Fix
In `generateSingleDayWithRetry`, derive `isLastDayInCity` and `nextLegTransport` from `context.multiCityDayMap` (the same data source the prompt section already uses at lines 1917-1921), then use them in the strip filter at line 2581.

### Change in `supabase/functions/generate-itinerary/index.ts`

**1. After line ~1889 (where `dayCity` is already resolved), add:**
```typescript
const isLastDayInCity = dayCity?.isLastDayInCity || false;
const nextDayInfo = context.multiCityDayMap?.[dayNumber]; // dayNumber is 1-indexed, so [dayNumber] = next day
const nextLegTransport = nextDayInfo?.transportType || '';
```

**2. At line 2581, replace the dead references:**
```typescript
// Before (dead code):
if (paramIsLastDayInCity && !isLastDay && resolvedNextLegTransport && resolvedNextLegTransport !== 'flight') {

// After:
if (isLastDayInCity && !isLastDay && nextLegTransport && nextLegTransport !== 'flight') {
```

And update the log at line 2596 similarly.

### File Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Derive `isLastDayInCity` and `nextLegTransport` from context in full-gen path; fix dead airport strip filter |

