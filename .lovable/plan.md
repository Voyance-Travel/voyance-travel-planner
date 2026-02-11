

# Fix: Remove Legacy Credit Check from generate-itinerary Edge Function

## Problem

The `generate-itinerary` edge function contains a redundant credit check that uses a **stale rate of 150 credits/day** instead of the correct 60 credits/day. This overrides the client-side generation gate's correct authorization, causing paid trips to only generate 2 days instead of all days.

```text
CLIENT (correct):     4 days x 60  = 240 credits needed. User has 290. APPROVED.
EDGE FUNCTION (wrong): 4 days x 150 = 600 credits needed. User has 50*. DENIED. Cap to 2 days.

* Balance is 50 because the client already charged 240
```

## What Will Change

**File:** `supabase/functions/generate-itinerary/index.ts`

### Change 1: Remove legacy free-tier check block (lines 6281-6408)

Remove ~128 lines containing:
- Stripe subscription lookup (lines 6291-6316) -- redundant, client gate handles this
- `trip_purchases` "Trip Pass" check (lines 6318-6333) -- obsolete concept
- Credit recalculation at 150/day (lines 6370-6402) -- wrong rate
- `if (isFreeUser) { context.totalDays = Math.min(originalTotalDays, 2); }` (lines 6404-6408) -- **the bug**

Replace with:

```typescript
// Credit authorization is handled by the client-side generation gate
// (useGenerationGate.ts) BEFORE this function is called.
// The gate charges credits at 60/day and only invokes this function
// when authorized. No duplicate check needed here.
const originalTotalDays = 0; // Set after context prep
```

### Change 2: Remove `freeTierInfo` from response (lines 7652-7659)

The `isFreeUser` variable no longer exists, so remove the metadata block that references it.

## Why This Is Safe

| Concern | Answer |
|---------|--------|
| Could users bypass payment? | No -- the client gate charges credits BEFORE calling the edge function |
| What about locked mode? | The edge function is never called in locked mode -- client creates local placeholders |
| What about first trips? | Client gate handles it -- generates all days, frontend caps unlock to 2 |

## Expected Result

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| Paid 4-day trip (240 credits) | Generates 2 days, locks rest | Generates 4 days, all unlocked |
| First trip (5 days, free) | Generates 2 days | Generates 5 days, frontend unlocks 2 |
| Preview mode (no credits) | Edge function never called | No change |

## Fix Number

This is **Fix 9 of 9** -- the final piece. All 8 client-side fixes are verified and correct. They just need the edge function to stop overriding them.

