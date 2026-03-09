
# Multi-City Upfront Charge + Chained Generation Implementation Plan

## Overview
I need to implement a seamless multi-city journey experience where users pay once upfront for all legs and generation auto-chains between legs. The system will build on the existing `journey_id`, `journey_order`, and `journey_total_legs` structure from `splitJourneyIfNeeded()`.

## Current State Analysis
- The `useGenerationGate.ts` doesn't have journey logic yet
- `ItineraryGenerator.tsx` needs journey context detection and UI updates  
- The generation engine needs auto-chaining logic
- No journey progress UI exists yet

## Implementation Plan

### Task 1: Implement Multi-City Upfront Journey Payment
**Files**: `src/hooks/useGenerationGate.ts`

**Changes needed**:
1. Update `GateResult` interface to include `journeyContext` with leg information
2. Add journey detection logic in `authorize()` to check if `journey_order === 1`
3. Fetch all journey legs and calculate total cost for entire journey
4. Add pre-paid check to skip credit verification for legs marked as paid
5. After successful payment, mark all journey legs with `journey_credits_paid: true` in metadata

**Key logic**:
- When `journey_order === 1`, fetch all legs and use combined days/cities for cost calculation
- Store journey payment metadata on all legs to prevent double-charging
- Subsequent legs bypass credit checks if `journey_credits_paid: true`

### Task 2: Update Generator UI for Journey Context
**Files**: `src/components/itinerary/ItineraryGenerator.tsx`

**Changes needed**:
1. Extract journey context from gate result
2. Update cost confirmation UI to show "Full Journey: City A → City B → City C"
3. Display total days across all cities instead of just current leg
4. Change button text to "Generate Full Journey (X cities)" for Leg 1
5. Show journey breakdown in cost display

### Task 3: Add Auto-Chain Generation Logic  
**Files**: `supabase/functions/generate-itinerary/index.ts`

**Changes needed**:
1. After completing final day of a leg, check if part of journey
2. Find next leg in journey sequence
3. Fire HTTP request to trigger next leg generation
4. Mark next leg as generating and handle errors gracefully
5. Skip credit checks for auto-chained legs (already paid)

**Key logic**:
- Use fire-and-forget HTTP calls to self-invoke for next leg
- Pass `creditsCharged: 0` for chained legs
- Store chain metadata for debugging and recovery

### Task 4: Create Journey Progress UI
**Files**: `src/pages/TripDetail.tsx`

**Changes needed**:
1. Add journey progress monitoring hook to poll all leg statuses
2. Create persistent bottom banner showing generation progress
3. Display progress dots for each leg (completed/generating/pending)
4. Add navigation between completed legs
5. Show "Journey Complete" message when all legs ready

### Task 5: Add Journey Error Recovery
**Files**: Multiple files for error handling

**Changes needed**:
1. Handle auto-chain failures gracefully
2. Mark failed legs with `auto_chain_failed: true`
3. Provide manual retry without re-charging
4. Show appropriate error messages and recovery options

## Technical Considerations

### Credit Flow
- First leg charges for entire journey upfront
- Journey payment metadata prevents double-charging
- Subsequent legs skip payment validation
- Idempotency protection against duplicate charges

### Generation Chaining
- Self-invoking edge function architecture
- Proper error handling and fallback mechanisms
- Journey metadata propagation between legs
- Real-time progress tracking via database

### State Management
- Journey context passed through gate results
- UI polls for multi-leg progress updates
- Proper cache invalidation across legs
- Browser refresh resilience

## Implementation Order
1. **Journey Payment Logic** - Core credit system changes
2. **Generator UI Updates** - User-facing cost display  
3. **Auto-Chaining Logic** - Backend generation flow
4. **Progress UI** - Real-time journey tracking
5. **Error Recovery** - Graceful failure handling

## Testing Strategy
- 3-city journey charges once for all legs
- Auto-generation flows seamlessly between legs
- Users can view completed legs while others generate
- Failed chains allow manual retry without re-charge
- Existing single-city flows remain unchanged

This implementation will create a seamless multi-city experience while maintaining backward compatibility and providing robust error recovery.
