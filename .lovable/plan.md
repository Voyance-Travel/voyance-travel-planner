

# Fix: Airport codes used as city names in trip creation

## Problem
When a user says something like "flying into LGA, out of JFK for a New York trip", the AI chat planner correctly extracts `arrivalAirport: "LGA"` and `departureAirport: "JFK"`, but then **also** sets `destination: "LGA, JFK"` — treating airport codes as city names. The comma triggers multi-city detection, creating "Trip to LGA, JFK" with two fake cities.

## Root Cause
Two layers missing:
1. **Prompt gap**: The `chat-trip-planner` edge function doesn't explicitly tell the AI that airport codes are NOT destinations
2. **No defensive guard**: Neither `cityNormalization.ts` nor `Start.tsx` filters out IATA airport codes from city candidates

## Fix

### 1. Prompt fix — `supabase/functions/chat-trip-planner/index.ts`

Add to the system prompt (near the existing CRITICAL RULES section, ~line 80):

```
AIRPORT vs CITY — CRITICAL:
- The "destination" field must ALWAYS be a CITY NAME, never an airport code.
- "LGA", "JFK", "LAX", "CDG", "LHR" etc. are AIRPORTS, not destinations.
- If the user says "flying into LGA, out of JFK", the destination is "New York", NOT "LGA, JFK".
- Airport codes go ONLY in arrivalAirport / departureAirport fields.
```

### 2. Defensive guard — `src/utils/cityNormalization.ts`

Add an IATA airport code detector to `isRegionNotCity()` or as a separate guard. Common approach: reject any candidate that is exactly 3 uppercase letters (standard IATA format) or matches a set of known major airport codes. This prevents airport codes from ever being treated as city names in the fallback parser.

```typescript
function looksLikeAirportCode(candidate: string): boolean {
  const trimmed = candidate.trim();
  // Standard IATA: exactly 3 letters
  if (/^[A-Z]{3}$/i.test(trimmed)) return true;
  return false;
}
```

Filter these out in `resolveCities` alongside the existing `isRegionNotCity` check.

### 3. Additional guard — `src/pages/Start.tsx` (~line 2737)

When building `cleanDest`, also skip airport-code-like values:

```typescript
const cleanDest = (primaryCityName && !/^[A-Z]{3}$/i.test(primaryCityName)) 
  ? primaryCityName 
  : dest;
```

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/chat-trip-planner/index.ts` | Add prompt instruction that destination must be city names, not airport codes |
| `src/utils/cityNormalization.ts` | Add `looksLikeAirportCode` guard, filter airport codes from candidates |
| `src/pages/Start.tsx` | Guard `cleanDest` against airport-code-like values |

