
# Multi-City Upfront Charge + Chained Generation Plan

## Overview
The user wants to implement a seamless multi-city journey experience where:
1. Users pay once upfront for the entire journey (all legs combined)
2. Generation auto-chains from leg to leg automatically
3. Users can view completed legs while other legs generate in the background

## Current State Analysis
- `splitJourneyIfNeeded()` already creates separate trip records for each leg with `journey_id`, `journey_order`, and `journey_total_legs`
- Each leg is currently treated as an independent trip for payment and generation
- Users must manually navigate to each leg and trigger generation separately

## Implementation Plan

### Part 1: Upfront Journey Payment Logic

**File: `src/hooks/useGenerationGate.ts`**
- Add journey detection logic before credit authorization
- When `journey_order === 1`, fetch all journey legs and calculate total cost
- Pass combined days/cities to the authorization flow
- After successful payment, mark all legs as `journey_credits_paid: true`
- Skip credit checks for pre-paid legs

**File: `src/components/itinerary/ItineraryGenerator.tsx`**
- Detect journey context before calling `authorize()`
- Calculate total journey days and cities for cost estimation
- Update UI to show full journey cost breakdown

### Part 2: Auto-Chained Generation

**File: `supabase/functions/generate-itinerary/index.ts`**
- After completing the final day of a leg, check for next journey leg
- Auto-trigger generation for the next leg via self-invocation
- Handle journey metadata propagation
- Include proper error handling for chain failures

**Key Implementation Points:**
- Use fire-and-forget HTTP calls to chain to next leg
- Mark next leg as `itinerary_status: 'generating'`
- Pass `creditsCharged: 0` for chained legs (already paid)
- Store chain metadata for debugging and recovery

### Part 3: Progressive Journey UI

**File: `src/pages/TripDetail.tsx`**
- Add journey progress monitoring hook
- Create persistent bottom banner showing generation progress
- Display progress dots for each leg (completed/generating/pending)
- Add journey navigation buttons when all legs complete
- Handle auto-navigation to next ready leg

**File: `src/components/itinerary/ItineraryGenerator.tsx`**
- Update cost display to show journey totals
- Modify button text for journey context
- Ensure completion flow stays on current leg (no navigation away)

### Part 4: Error Recovery & Edge Cases

**Graceful Chain Failure:**
- If auto-chain fails, mark leg with `auto_chain_failed: true`
- Allow manual retry without re-charging
- Show appropriate UI prompts for failed legs

**Journey State Management:**
- Prevent double-charging via journey payment flags
- Handle concurrent generation attempts
- Maintain journey integrity across browser refreshes

### Part 5: UI Enhancements

**Journey Cost Display:**
- Show "Full Journey: City A → City B → City C"
- Display total days and cost breakdown
- Update button text to "Generate Full Journey (X cities)"

**Progress Tracking:**
- Real-time journey progress banner
- Visual progress dots for each leg
- Auto-refresh leg statuses while generating
- Navigation between completed legs

## Technical Considerations

### Credit Flow Changes
- First leg charges for entire journey
- Subsequent legs skip payment (pre-paid flag)
- Journey payment metadata stored on all legs
- Idempotency protection against duplicate charges

### Generation Chaining
- Self-invoking edge function calls
- Proper error handling and fallback
- Journey metadata propagation
- Progress tracking via database updates

### State Synchronization
- Real-time polling for journey progress
- Proper cache invalidation
- UI state management across legs
- Browser refresh resilience

## Files to Modify

1. `src/hooks/useGenerationGate.ts` - Journey payment logic
2. `src/components/itinerary/ItineraryGenerator.tsx` - UI updates and cost display
3. `supabase/functions/generate-itinerary/index.ts` - Auto-chaining logic
4. `src/pages/TripDetail.tsx` - Journey progress tracking and navigation
5. Database schema - Journey metadata fields (if needed)

## Testing Strategy

1. **Journey Payment**: 3-city trip charges once for all legs
2. **Auto-Chaining**: Generation flows seamlessly between legs
3. **Progressive UI**: Can view completed legs while others generate
4. **Error Recovery**: Failed chains allow manual retry without re-charge
5. **Existing Flows**: Single-city and short multi-city trips unchanged

## Risk Mitigation

- Extensive idempotency checks to prevent double-charging
- Graceful fallback for chain failures
- Preserve existing single-city generation flow
- Comprehensive error logging for debugging
- User-friendly error messages and retry options

This implementation will create a seamless multi-city experience while maintaining backward compatibility with existing trip types.
