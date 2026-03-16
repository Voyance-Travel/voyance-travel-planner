

# Fix: Multi-City Trip Stalling at Day 2

## Root Cause

The edge function crashes with `ReferenceError: context is not defined` when generating Day 2+. The error is in the `generate-day` action handler (starting line 6727), which does **not** define a `context` variable of type `GenerationContext`. However, lines 8209 and 8216-8217 reference `context.userConstraints`:

```typescript
// Line 8209
hasFullDayEvent: !!(context.userConstraints || []).find(...)

// Lines 8216-8217
const constraints = context.userConstraints || [];
```

**Why Day 1 works**: Day 1 takes the `isFirstDay` branch (line 8164), which skips the `else` block entirely. Day 2+ hits the `else` at line 8197 and crashes immediately on `context.userConstraints`.

The `context` variable is only available inside `generateSingleDayWithRetry()` (the batch generation path), not in the per-day `generate-day` action handler.

## Fix

**File**: `supabase/functions/generate-itinerary/index.ts`

Replace the two references to `context.userConstraints` (lines ~8209 and ~8216) with the equivalent data sourced from trip metadata, which is already loaded in this scope.

The `userConstraints` data lives in `metadata?.userConstraints` (the trip's metadata object, already fetched at line 7154-7159). Replace:

1. **Line 8209**: `context.userConstraints` → `(metadata?.userConstraints as any[]) || []`
2. **Line 8216**: `context.userConstraints` → `(metadata?.userConstraints as any[]) || []`

This is a 2-line fix that uses the already-available `metadata` variable (loaded from the trip record earlier in the same handler).

## Impact

This fix unblocks all multi-city and multi-day trip generation. Without it, any trip longer than 1 day will crash on Day 2 because the self-chaining `generate-trip-day` calls `generate-day` internally, which always hits this code path for non-first, non-last days.

