

## Fix: Cross-Day Restaurant Dedup Fails for Dining Titles

### Problem

"Breakfast at Rosa Salva" appears on Days 2, 3, and 4. The dedup system has the data to catch this but two bugs prevent it:

**Bug 1: `extractConcept` discards the venue name for dining titles.**
`extractConcept` splits on ` at ` and keeps the part BEFORE it — so `"breakfast at rosa salva"` → concept = `"breakfast"`, which gets stripped to nearly nothing. The venue identity `"rosa salva"` is thrown away. Every breakfast activity produces the same empty/generic concept, so `conceptSimilarity` never fires.

**Bug 2: `location.name` dedup requires length > 5.**
This works when `location.name` is populated, but AI-generated activities don't always include a `location` object, or the name may be set to the full title rather than the canonical venue name. This makes the location-based dedup unreliable for dining.

### Root Cause

`validate-day.ts` line 533-538:
```typescript
function extractConcept(title: string): string {
  const conceptPart = normalizeText(title).split(/\s+at\s+|\s+with\s+|\s+@\s+|\s+in\s+/i)[0];
  // ↑ For "Breakfast at Rosa Salva", this returns "breakfast"
  // "Rosa Salva" is discarded
  return conceptPart.replace(...)
}
```

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/validate-day.ts`**

Two changes:

**1. Fix `extractConcept` for dining titles** — when the title matches a `Meal at Venue` pattern, return the venue part (after "at"), not the meal keyword part (before "at"):

```typescript
function extractConcept(title: string): string {
  const normalized = normalizeText(title);
  
  // For dining titles ("Breakfast at X", "Dinner at X"), the concept
  // is the VENUE (after "at"), not the meal keyword (before "at")
  const mealAtVenue = normalized.match(
    /^(?:breakfast|brunch|lunch|dinner|supper)\s+(?:at|@)\s+(.+)/i
  );
  if (mealAtVenue && mealAtVenue[1].trim().length > 2) {
    return mealAtVenue[1].trim();
  }

  const conceptPart = normalized.split(/\s+at\s+|\s+with\s+|\s+@\s+|\s+in\s+/i)[0];
  return conceptPart
    .replace(/\b(class|tour|experience|visit|workshop|session|lesson|masterclass)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

**2. Add explicit dining venue dedup in `checkDuplicateConcept`** — import `extractRestaurantVenueName` from `generation-utils.ts` and build a previous-venue set from all prior dining activities. For each current dining activity, extract its venue name and check against the set:

```typescript
// Inside checkDuplicateConcept, after building previousConcepts/previousLocations:
const previousDiningVenues = new Set<string>();
for (const prevDay of previousDays) {
  for (const prevAct of prevDay.activities || []) {
    if ((prevAct.category || '').toLowerCase().includes('dining')) {
      const venue = extractRestaurantVenueName(prevAct.title || '');
      if (venue.length > 2) previousDiningVenues.add(venue);
      const locVenue = extractRestaurantVenueName(prevAct.location?.name || '');
      if (locVenue.length > 2) previousDiningVenues.add(locVenue);
    }
  }
}

// In the activity loop, before concept similarity check:
if (cat.includes('dining')) {
  const venueFromTitle = extractRestaurantVenueName(act.title || '');
  const venueFromLoc = extractRestaurantVenueName(act.location?.name || '');
  if ((venueFromTitle.length > 2 && previousDiningVenues.has(venueFromTitle)) ||
      (venueFromLoc.length > 2 && previousDiningVenues.has(venueFromLoc))) {
    results.push({
      code: FAILURE_CODES.DUPLICATE_CONCEPT,
      severity: 'error',
      message: `"${act.title}" repeats a restaurant from a previous day`,
      activityIndex: i,
      autoRepairable: true,
    });
    continue;
  }
}
```

This import requires adding `extractRestaurantVenueName` from `../generation-utils.ts` at the top of `validate-day.ts`.

### Why Both Changes?

- Fix 1 makes generic concept similarity work for dining (catches fuzzy matches like "Rosa Salva" vs "Caffè Rosa Salva")
- Fix 2 adds a precise venue-identity check using the same normalization as the restaurant pool/blocklist system (catches exact repeats even when titles differ, e.g. "Breakfast at Rosa Salva" vs "Morning Coffee at Rosa Salva")
- Together they ensure the `DUPLICATE_CONCEPT` validation fires, which triggers the existing repair-day pool-swap logic (step 4) to replace the duplicate with a different restaurant

### Summary

| File | Change |
|---|---|
| `validate-day.ts` | Fix `extractConcept` to return venue name for dining titles; add explicit dining venue dedup using `extractRestaurantVenueName` |

