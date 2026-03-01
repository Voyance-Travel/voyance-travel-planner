
# Fix: Account for Flight Duration When Determining Itinerary Start

## Status: ✅ IMPLEMENTED

## Changes Made

### 1. `supabase/functions/generate-itinerary/prompt-library.ts`
- **`extractFlightData()`** now populates `arrivalDate` and `departureDate` from legs data (user-marked `isDestinationArrival` leg preferred, with heuristic fallback)
- **`buildDayPrompt()`** detects cross-day flights (arrivalDate > departureDate) and routes Day 1 to a new `buildOutboundTravelDayPrompt()` instead of `buildArrivalDayPrompt()`
- **`buildOutboundTravelDayPrompt()`** generates constraints for a departure/travel day: pack, travel to airport, board, in-flight — no destination activities

### 2. `supabase/functions/generate-itinerary/index.ts`
- Added cross-day flight detection logging after context build (Stage 1.4.5)
- Logs when Day 1 will be a departure travel day

### 3. `src/services/cascadeTransportToItinerary.ts`
- Single-city: when outbound `arrival.date > departure.date`, cascade arrival to Day 2 instead of Day 1
- Multi-city: same cross-day detection for inbound flight, cascades to Day 2

## Edge Cases Handled
- No flight data → unchanged behavior
- Same-day arrival → unchanged behavior  
- Cross-day (red-eye) → Day 1 = travel day, Day 2 = arrival + destination activities
- Multi-leg with `isDestinationArrival` marker → uses correct leg's dates
- Manual entry without dates → falls back to current behavior
