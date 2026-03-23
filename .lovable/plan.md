

## Fix: Cross-Day Venue Duplication (Jerónimos Monastery on Day 1 & Day 2)

### Problem
The same physical venue (Jerónimos Monastery) appears on consecutive days with different titles:
- Day 1: "Guided Visit to Jerónimos Monastery"
- Day 2: "Jerónimos Monastery & Santa Maria Church"

This is a recurring issue (also seen with Royal Gardens on Venice).

### Root Cause — Two gaps in the dedup pipeline

**Gap 1: `conceptSimilarity` misses venue-name matches across differently-worded titles**

`extractConcept("guided visit to jeronimos monastery")` → strips "visit" → `"guided to jeronimos monastery"` (4 words)
`extractConcept("jeronimos monastery santa maria church")` → `"jeronimos monastery santa maria church"` (4 words)

Word overlap = {"jeronimos", "monastery"} = 2 common words. Threshold is `intersection/min > 0.6`, so 2/4 = 0.5 → **no match**. The similarity check fails.

**Gap 2: Cross-day validator only warns, doesn't error**

Even if similarity DID match, the cross-day check (line 441 in `day-validation.ts`) pushes a `warning` for general activities, not an `error`. The stripping logic in `index.ts` (line 10292) only acts on strings containing "TRIP-WIDE DUPLICATE" which is only pushed for `culinary_class`/`wine_tasting` types. General venue duplicates produce warnings that are logged but never enforced.

**Gap 3: No location-based cross-day dedup**

The cross-day validator (line 395-468) only compares title concepts, not location names/addresses. Two activities at the same physical address with different titles will never be flagged. The `deduplicateActivities` function (line 575) does check locations but only within a single day, not across days.

### Fix — 1 file, 2 changes

**`supabase/functions/generate-itinerary/day-validation.ts`**

**Change 1: Add location-based cross-day matching to `validateGeneratedDay`** (around line 395-468)

Before the concept-similarity loop, build a set of normalized location names from `previousDays`. Then for each activity in the current day, check if its location name matches a previous day's location. If so, push an **error** (not warning) with the "TRIP-WIDE DUPLICATE" prefix so the stripping logic in `index.ts` will act on it:

```typescript
// Build set of previous location names for cross-day location dedup
const previousLocations = new Set<string>();
for (const prevDay of previousDays) {
  for (const prevAct of prevDay.activities || []) {
    const locName = normalizeText(prevAct.location?.name || '');
    if (locName.length > 5) previousLocations.add(locName);
  }
}

// Inside the activity loop, before concept checks:
const actLocName = normalizeText(act.location?.name || '');
if (actLocName.length > 5 && previousLocations.has(actLocName)) {
  if (!isRecurringEvent(act, mustDoActivities)) {
    errors.push(`TRIP-WIDE DUPLICATE: "${act.title}" visits the same location as a previous day.`);
    continue;
  }
}
```

**Change 2: Improve `conceptSimilarity` to also check venue-name substring matching**

Add a venue-extraction step: extract the last significant noun phrase (likely the venue name) and check if it appears in both concepts. For titles like "Guided Visit to X" and "X & Y", extract "X" and check containment:

```typescript
// Inside conceptSimilarity, after the word-overlap check:
// Extract potential venue names (words after stripping common verbs/prepositions)
const STRIP_VERBS = /\b(guided|visit|explore|discover|tour|walk|stroll|head|go|return|morning|afternoon|evening)\b/g;
const aVenue = a.replace(STRIP_VERBS, '').replace(/\s+/g, ' ').trim();
const bVenue = b.replace(STRIP_VERBS, '').replace(/\s+/g, ' ').trim();
if (aVenue.length > 5 && bVenue.length > 5 && (aVenue.includes(bVenue) || bVenue.includes(aVenue))) {
  return true;
}
```

This catches "jeronimos monastery" (from title A after stripping) being contained in "jeronimos monastery santa maria church" (title B).

### Why this fixes it
- Location-based matching catches same-address visits regardless of title wording
- Improved concept similarity catches venue-name substrings across differently-worded titles
- Using `errors.push` with `TRIP-WIDE DUPLICATE:` prefix ensures the stripping logic in `index.ts` will auto-remove the duplicate activity

### Files
- `supabase/functions/generate-itinerary/day-validation.ts` — add cross-day location dedup + improve concept similarity

