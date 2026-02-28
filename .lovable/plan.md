
# Fix Flight Intelligence Field Name Mismatch

## Root Cause

The LLM returns intelligence data with **inconsistent field names** (snake_case vs camelCase, different key names entirely). The frontend expects specific camelCase fields like `destinationSchedule` and `missingLegs`, but the AI returns `destination_availability` and `missing_legs`. This means:

- `intelligence.destinationSchedule` is `[]` (empty) -- destinations never render
- `intelligence.missingLegs` is `[]` (empty) -- the Mallorca-to-Madrid warning never shows
- `intelligence.route.display` is undefined -- the smart route chain falls back to raw airport codes
- The BOS-to-ATL return leg shows in raw segments but is never labeled properly in the analysis

The AI actually **does detect** the missing PMI-to-MAD leg and classifies segments correctly -- the data is just stored under wrong keys.

## Solution

Add a **server-side normalization layer** in `parse-booking-confirmation/index.ts` that remaps whatever the AI returns into the canonical schema. This is more reliable than trying to force the LLM to use exact field names.

---

## Changes

### File: `supabase/functions/parse-booking-confirmation/index.ts`

Add a `normalizeIntelligence()` function after the AI response is parsed (after line 281) that:

1. **Normalizes `destinationSchedule`**: Checks for `destination_availability`, `destination_schedule`, or `destinationSchedule` -- whichever exists, maps it into the canonical `destinationSchedule` array with camelCase fields (`availableFrom`, `availableUntil`, `fullDays`, `isFirstDestination`, `isLastDestination`)

2. **Normalizes `missingLegs`**: Checks for `missing_legs` or `missingLegs` -- maps to canonical `missingLegs` array with `fromCity` (not `from_city`), `toCity` (not `to_city`), `suggestedDateRange`, `priority`

3. **Normalizes `route`**: If `route` is empty but `route_summary` exists, sets `route.display = route_summary`. Also checks for `route_display` or `routeDisplay` variants

4. **Normalizes `layovers`**: Remaps `arrival`/`departure` to `arrivalTime`/`departureTime` if needed

5. **Normalizes `warnings`**: If the AI returns plain strings instead of objects, wraps each into `{ type: 'GENERAL', message: string, severity: 'WARNING' }`

6. **Normalizes `summary`**: Checks for `summary` or `route_summary` and ensures it's a string

This function runs **before** the response is sent, ensuring the frontend always gets the expected schema regardless of LLM output variation.

### Prompt Enhancement (same file)

Also tighten the prompt to explicitly specify the exact JSON structure with camelCase field names and provide an example output. This reduces (but doesn't eliminate) the need for normalization. Specifically:

- Add a concrete JSON example in the Phase 2 instructions showing the exact keys: `destinationSchedule` (not `destination_availability`), `missingLegs` (not `missing_legs`), `route.display` (not `route_summary`)
- Emphasize "Use EXACTLY these camelCase field names"

### Deploy

Redeploy the `parse-booking-confirmation` edge function.

---

## Technical Details

The normalization function will look like this (pseudocode):

```text
function normalizeIntelligence(raw: any): FlightIntelligence {
  // 1. destinationSchedule: check raw.destinationSchedule || raw.destination_availability || raw.destination_schedule
  // 2. For each entry: map airport_code -> airport, from_city -> fromCity, etc.
  // 3. missingLegs: check raw.missingLegs || raw.missing_legs
  // 4. For each: from_city -> fromCity, to_city -> toCity
  // 5. route: if raw.route is empty object, try raw.route_summary or raw.routeDisplay
  // 6. layovers: normalize arrivalTime/departureTime field names
  // 7. warnings: wrap strings into objects
  // 8. summary: raw.summary || raw.route_summary fallback
}
```

This is applied at line ~324 (before building the response) so `intelligence` is always canonical before it reaches the frontend.

## Why This Approach

- LLMs are unreliable at following exact field naming conventions -- normalization is the only robust defense
- The prompt improvements help reduce normalization work but cannot guarantee it
- Zero frontend changes needed -- the existing UI code already handles the canonical schema correctly
- Backward compatible -- trips without intelligence still work fine
