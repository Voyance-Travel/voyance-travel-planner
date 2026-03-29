

# Fix: Ensure Hotel Relaxing & Airport Departure Cards

## Problem
Two types of activity cards are missing from generated itineraries:
1. **Hotel relaxing card** — When returning to the hotel mid-day (e.g., between afternoon and evening), only a transport entry exists. There's no dedicated accommodation card showing time at the hotel (freshen up, rest, change clothes).
2. **Airport departure card** — On the last day, the "Departure" card (security, check-in, boarding) may be stripped by frontend dedup logic.

## Root Causes

### Hotel Relaxing (Backend)
In `compile-prompt.ts` line 425, the "HOTEL RETURN" instruction says "REQUIRED **if dinner is far from hotel**" — making it conditional. The AI often skips it. The bookend repair (`repair-day.ts` line 689-696) does inject "Freshen up at [Hotel]" but only when a transport-to-hotel activity exists without a following accommodation card. If the AI skips both the transport AND the accommodation card, nothing catches it.

**Fix**: Make the hotel return instruction unconditional in the prompt, and strengthen the bookend repair to guarantee a mid-evening hotel return on full exploration days.

### Airport Departure (Frontend)
In `EditorialItinerary.tsx` lines 1865-1890, when a synthetic departure card is injected, the dedup filter strips AI-generated activities matching hub tokens (`airport`, `station`, etc.) including departure/security cards. The "Departure" card from the AI (with "Check-in, security, and boarding") gets caught by this filter because its title contains "airport" or "departure" keywords.

**Fix**: Preserve AI-generated "Departure" / "Security" cards that have category `transport` and describe airport procedures, rather than stripping all airport-keyword matches.

## Changes

### 1. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` (~line 425)
Make hotel return mandatory on full exploration days (not conditional on dinner distance):

```typescript
// Before:
${flightContext.hotelName ? `6. HOTEL RETURN (REQUIRED if dinner is far from hotel) — ...` : ''}

// After:
${flightContext.hotelName ? `6. HOTEL RETURN (REQUIRED) — "Freshen up at [EXACT Hotel Name]" with category "accommodation", duration 30 min. Every full day MUST include a hotel return between afternoon activities and dinner. This MUST be a separate activity card.` : ''}
```

### 2. `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (~line 698)
Strengthen end-of-day hotel return to also guarantee a mid-day return on full exploration days (when day has both lunch and dinner):

After the existing end-of-day hotel return (line 698-706), add a mid-day return check:
- If the day has both a lunch and dinner activity but NO accommodation card between them, inject "Freshen up at [Hotel]" with a 30-minute slot between the last afternoon activity and dinner.

### 3. `src/components/itinerary/EditorialItinerary.tsx` (~line 1880)
Preserve AI-generated departure/security cards during dedup. The filter currently removes all activities with "departure" in the title — modify to keep activities with category `transport` that describe airport check-in/security procedures (not transfer/transit activities):

```typescript
// Add exclusion: keep "Departure" cards that describe airport procedures
const isAirportProcedure = t.includes('departure') && 
  (act.description || '').toLowerCase().includes('security') || 
  (act.description || '').toLowerCase().includes('check-in') || 
  (act.description || '').toLowerCase().includes('boarding');
if (isAirportProcedure) return true; // Keep this card

const isDepartureActivity = t.includes('departure from') || ...
```

## Files to modify
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — make hotel return mandatory
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add mid-day hotel return guarantee
- `src/components/itinerary/EditorialItinerary.tsx` — preserve airport departure cards in dedup

