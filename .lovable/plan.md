

## Fix 23A: Defensive Guards for Day Regeneration

### Finding

The main bug (saving raw array instead of wrapped object) is **already fixed** in the current code — line 587 wraps with `{ ...existingItinerary, days: updatedDays }`. No change needed there.

Two additions are still valuable:

### Change 1: Day Count Validation (src/services/itineraryAPI.ts)

After line 585 (`updatedDays.sort(...)`), add a safety check before saving:

```typescript
// Safety: ensure we haven't lost any days during regeneration
const expectedDays = totalDays || existingItinerary.days.length;
if (updatedDays.length < expectedDays) {
  console.error(
    `[regenerateDay] Day count mismatch! Expected ${expectedDays} but have ${updatedDays.length}. Aborting save.`
  );
  throw new Error(`Day count mismatch: expected ${expectedDays}, got ${updatedDays.length}`);
}
```

Uses the already-computed `totalDays` variable (line 522) — no extra DB query needed.

### Change 2: Raw Array Fallback in Parser (src/utils/itineraryParser.ts)

At line 514, before the `const data = rawData as Record<string, unknown>` cast, add:

```typescript
// Handle corrupted format where itinerary_data is a raw array
if (Array.isArray(rawData)) {
  console.warn('[itineraryParser] itinerary_data is a raw array — treating as days');
  // Recurse with wrapped object
  return parseItineraryDays({ days: rawData }, tripStartDate);
}
```

This catches any historically corrupted records where the data is `[...]` instead of `{ days: [...] }`.

### Files (2)
- `src/services/itineraryAPI.ts` — add day count guard after sort
- `src/utils/itineraryParser.ts` — add Array.isArray fallback at top of parseItineraryDays

