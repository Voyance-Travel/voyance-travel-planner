

## Fix: AI Notes Lost on Page Reload

### Problem
AI notes save correctly to the database (the `aiNotes` array is included in the JSON blob written to `trips.itinerary_data`), but they are stripped when the itinerary is loaded back from the database. 

The `convertBackendActivity()` function in `src/types/itinerary.ts` constructs a new object with explicit field assignments and does not include `aiNotes`. Every load path (`useLovableItinerary.ts`, `ItineraryPreview.tsx`) runs through this converter, so `aiNotes` is silently dropped.

### Fix

**File: `src/types/itinerary.ts`**

1. Add `aiNotes` as an optional field to the `ItineraryActivity` interface (around line 55):
   ```ts
   aiNotes?: Array<{ id: string; content: string; savedAt: string; query?: string }>;
   ```

2. Add `aiNotes` as an optional field to the `BackendActivity` interface (around line 89):
   ```ts
   aiNotes?: Array<{ id: string; content: string; savedAt: string; query?: string }>;
   ```

3. In `convertBackendActivity()` (line 264-282), add `aiNotes` to the returned object:
   ```ts
   aiNotes: activity.aiNotes,
   ```

This ensures AI notes survive the save → load round-trip without affecting any other functionality.

### Files Changed
1. `src/types/itinerary.ts` — add `aiNotes` to both interfaces and to the converter function

