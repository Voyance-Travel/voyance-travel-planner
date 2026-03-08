

## Problem

When the user clicks "Optimize", the edge function does **far more than just fixing transportation routes**:

1. **Gap filling is ON by default** — The client doesn't send `enableGapFilling`, so the server defaults it to `true` (line 1664). This inserts "Free Time" / "Wellness" blocks into every gap ≥30 min, adding 5+ phantom activities.

2. **Route reordering rearranges activities** — `enableRouteOptimization: true` runs a nearest-neighbor algorithm that reorders flexible activities by geographic proximity, moving them to different time slots. The user's intentional ordering is destroyed.

3. **Times get shuffled** — When route optimization reorders activities, it reassigns original time slots to the new order (line 157-162 in the auto-route-optimizer). So an activity the user placed at 10 AM might end up at 2 PM.

The user's expectation: "Optimize" should **only** update transportation info between activities (method, duration, cost) without changing activity order, times, or inserting new blocks.

## Plan

### Change 1: Client — disable destructive features in optimize call

**File:** `src/components/itinerary/EditorialItinerary.tsx` (~line 2880)

Add explicit flags to the optimize request body:

```typescript
enableRouteOptimization: false,  // Don't reorder activities
enableGapFilling: false,          // Don't insert free time blocks
enableRealTransport: true,        // DO update transport between activities
enableCostLookup: true,           // DO update cost estimates
enableTagGeneration: false,       // Skip tag regeneration (unnecessary)
```

This is the minimal, safe fix — the user keeps their activity order and times intact, and only gets improved transportation data between stops.

### Change 2: Server — change gap filling default to false

**File:** `supabase/functions/optimize-itinerary/index.ts` (line 1664)

Change the default so gap filling is opt-in rather than opt-out:

```typescript
const enableGapFilling = body.enableGapFilling ?? userPrefs?.enable_gap_filling ?? false;
```

This prevents any caller that forgets to send the flag from getting surprise "Free Time" blocks.

### Files Modified

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Explicitly disable route reordering, gap filling, and tag generation in optimize call |
| `supabase/functions/optimize-itinerary/index.ts` | Change `enableGapFilling` default from `true` to `false` |

