

## Fix: Add City-Boundary Checkout/Check-in to generate-day Handler

### Problem
The `generate-day` action (used by the sequential day-chain) extracts `paramIsFirstDayInCity` and `paramIsLastDayInCity` from the request (line 6456) but never uses them. The Day 1/Last Day decision tree (lines 7109-7736) only checks `isFirstDay` (trip Day 1) and `isLastDay` (trip last day). So mid-journey city boundaries — e.g., checking out of a hotel on the last day of City A, or checking into a hotel on the first day of City B — get no checkout/check-in/transport constraints at all.

### Change

**File: `supabase/functions/generate-itinerary/index.ts`** — Insert after line 7736 (after the closing `}` of the `else if (isLastDay) { ... }` block, before the transport preferences section at line 7738).

Add a new block that appends to `dayConstraints` when multi-city boundary flags are set:

```typescript
// ===== MULTI-CITY: Per-City Boundary Constraints =====
if (paramIsMultiCity) {
  const hotelName = paramHotelOverride?.name || flightContext.hotelName || 'Hotel';

  if (paramIsFirstDayInCity && !isFirstDay && !paramIsTransitionDay) {
    // First day in a NEW city (not trip Day 1, not a transition day)
    dayConstraints += `\n\n🏨 CITY ARRIVAL — CHECK-IN DAY:
- This is the first day in ${destination}. The traveler needs to check into "${hotelName}".
- REQUIRED: Include a "Hotel Check-in & Refresh" activity (typically 30-60 min).
- Plan afternoon/evening activities after check-in, clustered near the hotel area.
- Use "${hotelName}" for ALL hotel references. Do NOT invent a different hotel.`;
  }

  if (paramIsLastDayInCity && !isLastDay) {
    // Last day in this city but NOT the last day of the trip
    dayConstraints += `\n\n🏨 CITY DEPARTURE — CHECKOUT DAY:
- This is the LAST DAY in ${destination}. The traveler leaves this city tomorrow.
- REQUIRED: Include "Hotel Checkout" activity in the morning (typically by 11:00 AM).
- Plan morning activities around checkout. Luggage storage may be needed.
- End the day early enough for evening packing/preparation.
- Use "${hotelName}" for the checkout activity. Do NOT invent a different hotel.`;
  }

  // Reinforce correct hotel name on any multi-city day
  if (hotelName && hotelName !== 'Hotel') {
    dayConstraints += `\n\n🏨 ACCOMMODATION: "${hotelName}" — use this name for ALL hotel references. Do NOT substitute a different hotel name.`;
  }
}
```

This is a single insertion point. No other files need changes — `paramIsFirstDayInCity`, `paramIsLastDayInCity`, `paramIsMultiCity`, `paramIsTransitionDay`, and `paramHotelOverride` are already destructured at line 6452-6456.

