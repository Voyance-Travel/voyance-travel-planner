
# Multi-City Transport Comparison Module: End-to-End Implementation

## Overview

This plan fixes three interconnected issues:
- **Issue #41**: Auto-trigger transport comparison on multi-city detection, bake chosen option into itinerary
- **Issue #40**: Make travel days mandatory (no teleporting)
- **Issue #26**: Enforce realistic buffer times between activities

Currently, transition days get a single vague sentence in the prompt ("Start the day with travel/transfer..."), the `destinations` branch drops `transportType`, and the frontend has zero transition-day rendering.

---

## Phase 1: Backend -- Mandatory Transition Day + Transport Comparison

### 1A. Fix `transportType` data loss in `index.ts`

The `destinations` JSONB branch (lines 3917-3935) builds the day map but never includes `transportType`. Only the `trip_cities` fallback does. 

**Fix**: Always query `trip_cities` first (it has `transport_type`), fall back to `destinations` JSONB only if `trip_cities` is empty. This reverses the current priority order.

### 1B. Create `buildTransitionDayPrompt()` in `prompt-library.ts`

New exported function that generates a structured prompt for transition days. Takes `transitionFrom`, `transitionTo`, `transportType`, traveler DNA, and archetype.

The prompt enforces this mandatory structure:
1. Morning: Hotel checkout in City A
2. Transfer to departure point (station/airport/terminal)
3. Inter-city travel leg using selected transport mode
4. Arrival and transfer to hotel in City B
5. Check-in and freshen up
6. Light evening exploration + dinner near hotel in City B

The prompt also requires the AI to return a `transportComparison` object with 3+ options:

```text
transportComparison: [
  {
    id: string,
    mode: "train" | "flight" | "bus" | "car" | "ferry",
    operator: string,
    inTransitDuration: string,
    doorToDoorDuration: string,
    cost: { perPerson: number, total: number, currency: string, includesTransfers: boolean },
    departure: { point: string, neighborhood: string },
    arrival: { point: string, neighborhood: string },
    pros: string[],
    cons: string[],
    bookingTip: string,
    scenicOpportunities: string[],
    isRecommended: boolean,
    recommendationReason: string
  }
]
selectedTransportId: string  // Matches the user's chosen mode or AI recommendation
```

The prompt includes archetype-aware recommendation logic:
- Luxury Seeker: prioritize comfort and city-center-to-city-center
- Budget Backpacker: prioritize cheapest total cost
- Adventurous Explorer: prioritize scenic/stopover opportunities

### 1C. Wire transition prompt into `generate-day` flow

In the main day generation loop (around line 4665), when `isTransitionDay === true`:
- Replace the weak 2-line `multiCityPrompt` with the full output of `buildTransitionDayPrompt()`
- Override the activity count constraints (transition days have a fixed structure, not the normal min/max)
- Add `transportComparison` to the tool schema's day output definition

### 1D. Add buffer time post-processor

After the AI generates a day (before validation), run a deterministic pass:
- Sort activities chronologically
- For each consecutive pair, compute gap
- Apply minimum buffers: 15min default, 30min for hotel, 45-60min for airport
- If gap is insufficient, shift downstream activities forward
- Log any shifts for debugging

### 1E. Validate transition days

In `validateGeneratedDay()`, add a check: if `isTransitionDay === true`, the day MUST contain at least one activity with category "transport" or "transit" that references inter-city travel. Fail validation otherwise, triggering a retry.

---

## Phase 2: Frontend -- Types, Parser, and UI

### 2A. Extend `EditorialDay` type

Add to `EditorialDay` in `EditorialItinerary.tsx`:
```typescript
city?: string;
country?: string;
isTransitionDay?: boolean;
transitionFrom?: string;
transitionTo?: string;
transportComparison?: TransportOption[];
selectedTransportId?: string;
```

Define `TransportOption` interface matching the backend schema.

### 2B. Update `itineraryParser.ts`

In `parseDay()`, pass through the new fields:
- `city`, `country`, `isTransitionDay`, `transitionFrom`, `transitionTo`
- `transportComparison`, `selectedTransportId`

These already partially flow through via `[key: string]: unknown` but need explicit handling for type safety and downstream rendering.

### 2C. Build `TransportComparisonCard` component

New component in `src/components/itinerary/TransportComparisonCard.tsx`:

- Renders inside the day card for transition days, between the checkout and arrival activities
- Shows a comparison table/cards for each transport option with:
  - Mode icon + operator name
  - Door-to-door time vs in-transit time
  - Total cost for the group (not just per-person)
  - Departure and arrival points with neighborhood context
  - Pros/cons pills
  - Booking tip
  - Scenic/stopover opportunities
  - "Recommended" badge on the AI pick with reason
- User can click "Select" on any option
- Selected option updates the day's timeline activities (departure time, arrival time, transfer logistics)
- Selection is persisted to the trip's `itinerary_data` in the database

### 2D. Integrate into `EditorialItinerary.tsx` day card rendering

In the day card rendering section:
- Detect `isTransitionDay === true`
- Show a visual city transition banner: "London to Paris" with transport icon
- Render `TransportComparisonCard` inline (not a separate tab)
- Show the city name badge on each day in the day strip/navigation

### 2E. Day strip city indicators

In the day navigation strip, show which city each day belongs to. For transition days, show an arrow icon between city names.

---

## Phase 3: Cross-Flow Detection Normalization

### 3A. Verify all 4 flows write `trip_cities` correctly

Check and fix each flow to ensure multi-city detection always produces:
- `is_multi_city = true` on the trip record
- Ordered `trip_cities` rows with `transport_type` defaults
- This was partially done in the previous plan; verify completeness for:
  - Build It Myself (manual builder)
  - Just Tell Us (chat planner) -- already wired
  - Mystery Getaway
  - Manual Paste / Smart Finish

### 3B. Default transport type

When no user selection exists, default to `'flight'` for international city pairs and `'train'` for same-country city pairs (heuristic). The AI recommendation in the comparison module will refine this.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-itinerary/index.ts` | Reverse priority to query `trip_cities` first; wire `buildTransitionDayPrompt` into generate-day; add `transportComparison` to tool schema; add buffer post-processor; add transition validation |
| `supabase/functions/generate-itinerary/prompt-library.ts` | New `buildTransitionDayPrompt()` function with mandatory structure and transport comparison schema |
| `src/components/itinerary/EditorialItinerary.tsx` | Extend `EditorialDay` type; render transition day banner and transport comparison inline; city indicators in day strip |
| `src/components/itinerary/TransportComparisonCard.tsx` | **New file** -- transport comparison UI component |
| `src/utils/itineraryParser.ts` | Pass through `city`, `isTransitionDay`, `transportComparison`, `selectedTransportId` explicitly |
| `src/hooks/useItineraryGeneration.ts` | Ensure `transportType` from `trip_cities` is always passed in generate-day payload |

---

## Execution Order

1. `prompt-library.ts` -- create `buildTransitionDayPrompt()`
2. `index.ts` -- reverse city data priority, wire transition prompt, add tool schema fields, add buffer post-processor, add transition validation
3. Deploy edge function and verify backend output
4. `itineraryParser.ts` -- explicit field pass-through
5. `EditorialItinerary.tsx` -- extend types
6. `TransportComparisonCard.tsx` -- new component
7. `EditorialItinerary.tsx` -- integrate transition day rendering
8. End-to-end test with "London and Paris" multi-city trip

---

## Risks and Mitigations

- **Risk**: Transport comparison data quality varies by city pair (AI may hallucinate operators/prices)
  - **Mitigation**: The comparison is clearly labeled as estimated; booking tips include "verify current prices"
  
- **Risk**: Transition day prompt increases token usage
  - **Mitigation**: Only fires on actual transition days (1 per city pair); non-transition days are unaffected

- **Risk**: Buffer enforcement shifts activities past reasonable evening times
  - **Mitigation**: Cap the latest activity at 23:00; if shifts push past that, drop the last activity and log a warning
