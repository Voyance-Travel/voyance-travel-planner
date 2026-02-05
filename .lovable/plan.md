
# Plan: Harden Itinerary Data Parsing

## Problem Analysis

The codebase has **multiple locations** where raw itinerary data from the database (`trip.itinerary_data`) is parsed using `.map()` loops with `as any` or `as unknown` casts. If the data contains `null`, `undefined`, or unexpected types, these loops can crash the app.

### Current Vulnerable Patterns

**1. ActiveTrip.tsx (lines 124-154)**
```typescript
return rawDays.map((d: any, idx: number) => ({
  dayNumber: d.dayNumber || idx + 1,
  // d could be null → accessing d.dayNumber crashes
  activities: (d.activities || []).map((a: any) => ({
    id: a.id || `activity-${idx}-${Math.random()}`,
    // Math.random() creates unstable IDs → React key warnings
```

**2. TripDetail.tsx (lines 867-910, 1059-1086)**
- Uses `as Record<string, unknown>` casts but no null guards before the cast
- Same pattern repeated twice in different render paths
- If `day` in the array is `null`, casting it to `Record<string, unknown>` and accessing properties will throw

**3. No Centralized Parser**
- Same parsing logic is duplicated 3+ times
- Each copy has slightly different field name handling (`startTime` vs `start_time`, `name` vs `title`)
- No validation that required fields exist

---

## Solution Architecture

### Phase 1: Create Centralized Safe Parser Utility

Create a new file `src/utils/itineraryParser.ts` with:

1. **Type-safe extraction functions**
   - `safeParseItinerary(raw: unknown): ParsedItinerary | null`
   - `safeParseDay(raw: unknown, index: number): ParsedDay | null`  
   - `safeParseActivity(raw: unknown, dayIdx: number, actIdx: number): ParsedActivity`

2. **Null filtering**
   - Filter out `null`/`undefined` entries before mapping
   - Log warnings for malformed entries (don't throw)

3. **Stable ID generation**
   - Replace `Math.random()` with deterministic IDs based on content hash or sequential counters
   - Example: `day-${dayNumber}-act-${actIndex}` instead of random

4. **Field normalization**
   - Handle both camelCase and snake_case variants (`startTime` / `start_time`)
   - Coerce types safely (e.g., `dayNumber` should be number, not string)

### Phase 2: Update Consumers to Use Safe Parser

Replace inline parsing in:

| File | Location | Current Pattern | New Pattern |
|------|----------|-----------------|-------------|
| `ActiveTrip.tsx` | Lines 124-154 | `rawDays.map((d: any)...)` | `parseItineraryDays(itinerary_data)` |
| `TripDetail.tsx` | Lines 867-910 | Inline mapping | `parseEditorialDays(itinerary_data)` |
| `TripDetail.tsx` | Lines 1059-1086 | Duplicate inline | Same parser call |

### Phase 3: Add Runtime Validation

Integrate with existing `itineraryValidator.ts` to:
- Log warnings for activities with missing required fields
- Track malformed data in console for debugging
- Never crash - always return safe defaults

---

## Technical Implementation

### New File: `src/utils/itineraryParser.ts`

```typescript
interface RawItineraryData {
  days?: unknown[];
  [key: string]: unknown;
}

interface ParsedActivity {
  id: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  // ... other fields with safe defaults
}

interface ParsedDay {
  dayNumber: number;
  date: string;
  theme?: string;
  activities: ParsedActivity[];
  weather?: { condition?: string; high?: number; low?: number };
}

/**
 * Safely parse itinerary_data JSONB from database
 * Never throws - returns empty array on malformed data
 */
export function parseItineraryDays(
  rawData: unknown,
  tripStartDate?: string
): ParsedDay[] {
  // 1. Validate top-level structure
  if (!rawData || typeof rawData !== 'object') {
    console.warn('[itineraryParser] Invalid itinerary data:', typeof rawData);
    return [];
  }
  
  const data = rawData as RawItineraryData;
  const rawDays = data.days;
  
  if (!Array.isArray(rawDays)) {
    console.warn('[itineraryParser] days is not an array:', typeof rawDays);
    return [];
  }
  
  // 2. Filter nulls BEFORE mapping
  return rawDays
    .filter((day): day is NonNullable<typeof day> => {
      if (day === null || day === undefined) {
        console.warn('[itineraryParser] Skipping null/undefined day entry');
        return false;
      }
      return true;
    })
    .map((day, idx) => parseSingleDay(day, idx, tripStartDate));
}

function parseSingleDay(
  raw: unknown, 
  index: number, 
  tripStartDate?: string
): ParsedDay {
  // Safe object access
  const d = (raw && typeof raw === 'object') 
    ? raw as Record<string, unknown> 
    : {};
  
  const dayNumber = typeof d.dayNumber === 'number' 
    ? d.dayNumber 
    : index + 1;
    
  const rawActivities = Array.isArray(d.activities) 
    ? d.activities 
    : [];
  
  return {
    dayNumber,
    date: extractString(d, ['date']) || calculateDayDate(tripStartDate, index),
    theme: extractString(d, ['theme', 'title']),
    description: extractString(d, ['description']),
    weather: extractWeather(d.weather),
    activities: rawActivities
      .filter(a => a !== null && a !== undefined)
      .map((a, actIdx) => parseSingleActivity(a, index, actIdx)),
  };
}

function parseSingleActivity(
  raw: unknown,
  dayIdx: number,
  actIdx: number
): ParsedActivity {
  const a = (raw && typeof raw === 'object') 
    ? raw as Record<string, unknown> 
    : {};
  
  return {
    // STABLE ID - no Math.random()
    id: extractString(a, ['id']) || `day${dayIdx + 1}-act${actIdx}`,
    title: extractString(a, ['title', 'name']) || 'Untitled Activity',
    description: extractString(a, ['description']),
    startTime: extractString(a, ['startTime', 'start_time', 'time']),
    endTime: extractString(a, ['endTime', 'end_time']),
    // ... continue for all fields
  };
}

// Helper: Extract string from object with multiple possible keys
function extractString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim()) return val;
  }
  return undefined;
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/itineraryParser.ts` | **NEW** - Centralized safe parser |
| `src/pages/ActiveTrip.tsx` | Import and use `parseItineraryDays()` |
| `src/pages/TripDetail.tsx` | Replace inline parsing with parser calls |
| `src/utils/typeGuards.ts` | Add `isValidItineraryData()` guard |

---

## Benefits

1. **No more crashes** from null/undefined in arrays
2. **Stable React keys** - no `Math.random()` causing re-renders
3. **Single source of truth** - one parser to fix/update
4. **Better debugging** - console warnings for malformed data
5. **Type safety** - properly typed output with defaults

---

## Testing Strategy

After implementation:
- Test with malformed `itinerary_data` (null entries, missing fields)
- Verify ActiveTrip page loads without errors
- Verify TripDetail page renders itinerary correctly
- Check console for parser warnings on edge cases
