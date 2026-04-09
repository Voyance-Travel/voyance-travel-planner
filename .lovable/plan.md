

# Fix: Complete the Activity Data Flow (Remaining Gaps)

The previous implementation added fields to interfaces, `saveTrip()`, and the hook's invoke bodies. However, three concrete gaps remain that prevent the "belt and suspenders" approach from working:

## Gap 1: `ItineraryGenerator.tsx` doesn't pass activity fields to `startServerGeneration()`

**File**: `src/components/itinerary/ItineraryGenerator.tsx` (lines 705-719)

The component calls `startServerGeneration()` with trip details but omits `mustDoActivities` and `perDayActivities`. Even though the hook accepts them, they arrive as `undefined`.

**Fix**: The component already has access to trip metadata (it loads the trip from DB). Add `mustDoActivities` and `perDayActivities` from the trip's metadata to the `startServerGeneration()` call. This requires reading them from the trip record's metadata where Start.tsx saved them.

## Gap 2: `action-generate-trip.ts` doesn't forward activity fields in chain body

**File**: `supabase/functions/generate-itinerary/action-generate-trip.ts` (lines 667-686)

When `generate-trip` chains to `generate-trip-day`, the chain body doesn't include `mustDoActivities` or `perDayActivities`. So even if the client sent them, they're dropped.

**Fix**: Not needed — `action-generate-trip-day.ts` reads these from `tripMeta` (DB), which is authoritative. But for robustness, we should also read from `params` as fallback.

## Gap 3: `action-generate-trip-day.ts` reads only from `tripMeta`, not `params`

**File**: `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (line 559-560)

Currently: `mustDoActivities: (tripMeta.mustDoActivities as string) || ''`

Should be: `params.mustDoActivities || tripMeta.mustDoActivities || ''` — so direct client params take priority, with metadata as fallback.

## Gap 4: Self-chain in `action-generate-trip-day.ts` also drops the fields

**File**: `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (lines 2497-2516)

The chain body for next-day generation doesn't include these fields. Not critical since each day re-reads `tripMeta`, but for consistency.

## Implementation

### 1. `src/components/itinerary/ItineraryGenerator.tsx`
- Find where the trip data is loaded (likely from DB or props)
- Pass `mustDoActivities` and `perDayActivities` from trip metadata to `startServerGeneration()` call at line ~705

### 2. `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- Line ~559: Change to read from `params` first, then `tripMeta` fallback
- Add diagnostic log showing source of activity data

### 3. Redeploy `generate-itinerary` edge function

### Files Changed
- `src/components/itinerary/ItineraryGenerator.tsx`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

