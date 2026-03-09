## Journey Sequential Generation — Implementation Status

### Part 1: Unified Cost Confirmation + Queue All Legs ✅ COMPLETE

**Implemented:**

1. **`src/hooks/useGenerationGate.ts`**:
   - Added `journeyId` and `journeyTotalLegs` to `GenerationGateParams` interface
   - Added journey detection: fetches all sibling legs when `journeyId` is present
   - Sums credit costs across all journey legs for unified billing
   - Uses `totalJourneyCost` instead of single-leg cost when in journey mode
   - After successful credit spend, queues sibling legs with `itinerary_status: 'queued'`

2. **`src/components/itinerary/ItineraryGenerator.tsx`**:
   - Added `journeyLegs` state for cost breakdown display
   - In `handleGenerate()`: fetches journey info if this is leg 1, populates `journeyLegs` array
   - Passes `journeyId` and `journeyTotalLegs` to the generation gate
   - Updated cost confirmation dialog:
     - Shows "Journey Cost Breakdown" header for journeys
     - Lists each leg with city, days, and cost
     - Shows "Journey Total" instead of "Total"
     - Uses `effectiveTotalCost` (journey sum or single-trip cost) for affordability checks
     - Disabled partial generation for journeys (must pay full upfront)
     - "Confirm & Generate Journey" button text for journeys

### Part 2: Auto-Chain Generation (TODO)

When leg 1 completes generation, the backend should:
1. Check for next queued leg in the journey
2. Automatically trigger `generate-trip` for the next leg
3. Continue until all legs are generated

Files to modify:
- `supabase/functions/generate-trip/index.ts` or similar edge function
- Add post-generation hook to detect and chain to next journey leg
