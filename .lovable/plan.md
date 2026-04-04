

## Fix: Dining-Specific Dedup in Post-Batch Pass

### Problem

The post-batch cross-day dedup has two layers: title-based word overlap (60% threshold) and location-name matching. Neither uses `extractRestaurantVenueName`, the purpose-built normalizer that strips meal prefixes like "Dinner at", "Tasting Menu at", etc. 

When "Belcanto" appears as "Dinner at Belcanto" (Day 1) and "Belcanto Tasting Menu Experience" (Day 3), the word-overlap check fails because shared meaningful words ("belcanto") are only 1 out of 4–5 words. The location-name check only works if both activities have identical `location.name` values. But `extractRestaurantVenueName` would normalize both to `"belcanto"` and catch the duplicate.

### Fix

**File: `supabase/functions/generate-itinerary/generation-core.ts`** — Post-batch dedup pass (~line 2390)

Add a **dining-specific venue dedup layer** using `extractRestaurantVenueName`, alongside the existing title-similarity and location-name checks:

1. Track `seenDiningVenues` (a map of normalized venue name → `{ dayNum }`)
2. For each `dining` category activity, normalize both `title` and `location.name` via `extractRestaurantVenueName`
3. If either normalized name matches a previously seen venue on a different day, mark for removal
4. This runs inside the existing activity loop, after the location-name check

```typescript
// Add alongside seenLocations
const seenDiningVenues = new Map<string, { dayNum: number }>();

// Inside the activity loop, after the location-name check, for dining activities:
if (cat === 'dining' || cat.includes('dining')) {
  const venueFromTitle = extractRestaurantVenueName(act.title || '');
  const venueFromLoc = extractRestaurantVenueName((act as any).location?.name || '');
  
  for (const venue of [venueFromTitle, venueFromLoc]) {
    if (venue.length <= 2) continue;
    const diningMatch = seenDiningVenues.get(venue);
    if (diningMatch && diningMatch.dayNum !== day.dayNumber) {
      console.log(`[Stage 2] Cross-batch dining dedup: removed "${act.title}" from Day ${day.dayNumber} (same restaurant "${venue}" on Day ${diningMatch.dayNum})`);
      indicesToRemove.push(i);
      dedupCount++;
      break;
    } else if (!diningMatch) {
      seenDiningVenues.set(venue, { dayNum: day.dayNumber });
    }
  }
}
```

### Why This Fixes the Belcanto Case

- Day 1: "Dinner at Belcanto" → `extractRestaurantVenueName` → `"belcanto"` → added to `seenDiningVenues`
- Day 3: "Belcanto Tasting Menu Experience" → `extractRestaurantVenueName` → `"belcanto"` → **match** → removed

### Technical Details

- Import `extractRestaurantVenueName` at the top of `generation-core.ts` (already exported from `generation-utils.ts`)
- Single block addition inside the existing post-batch dedup loop
- No changes to other files
- Complements (not replaces) the existing title-similarity and location-name checks

