

# Add Per-City Hotel Support to Chat Trip Planner

## Summary
Add `hotelName` to the `cities` array in the `extract_trip_details` tool schema so multi-city trips can capture different hotels per city. Also update the system prompt's multi-city example.

## Changes

### File: `supabase/functions/chat-trip-planner/index.ts`

**1. Update system prompt multi-city example** (lines 105-107)

Replace the current example block with an updated version that includes `hotelName` in the cities array example and adds guidance for multiple hotels in the same city.

**2. Add `hotelName` to cities array schema** (lines 413-435)

Add `hotelName` property to the cities item properties, with description noting comma-separated format for multiple hotels in the same city. Update the array-level description to mention hotel details.

### Specific edits:

**Lines 105-107** — Replace:
```
- ALWAYS include BOTH the "destination" summary AND the "cities" array. Example for "London and Paris, 10 days":
  destination: "London, Paris"
  cities: [{name: "London", country: "United Kingdom", nights: 4}, {name: "Paris", country: "France", nights: 5}]
```
With:
```
- ALWAYS include BOTH the "destination" summary AND the "cities" array. Example for "London and Paris, 10 days, staying at The Ritz in London and Le Meurice in Paris":
  destination: "London, Paris"
  cities: [{name: "London", country: "United Kingdom", nights: 4, hotelName: "The Ritz London"}, {name: "Paris", country: "France", nights: 5, hotelName: "Le Meurice"}]
- When the user has MULTIPLE hotels in the SAME city, list them in the hotelName field with date ranges: hotelName: "Mandarin Oriental (Apr 10-11), Radisson Blu (Apr 11-15)"
```

**Lines 413-435** — Add `hotelName` property to cities items and update description:
```typescript
cities: {
  type: "array",
  description:
    "REQUIRED for multi-city trips. Ordered list of cities with estimated nights and hotel details. If user mentions 2+ cities, this MUST be populated — without it only the first city gets planned. For single-city trips, use an empty array [].",
  items: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "City name",
      },
      country: {
        type: "string",
        description: "Country name",
      },
      nights: {
        type: "number",
        description: "Number of nights in this city",
      },
      hotelName: {
        type: "string",
        description: "Hotel name for this city if mentioned. For multiple hotels in the same city, list them comma-separated with date ranges: 'Mandarin Oriental (Apr 10-11), Radisson Blu (Apr 11-15)'",
      },
    },
    required: ["name", "nights"],
  },
},
```

### What's NOT changed
- No changes to generation chain or `action-generate-trip-day.ts`
- No changes to `parse-trip-input`
- No removal of existing fields (`hotelName` at top level remains for single-city trips)
- Only `chat-trip-planner/index.ts` is modified

