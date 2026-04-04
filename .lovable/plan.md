

## Fix: Post-Batch Location-Based Dedup for Trip-Wide Venue Duplicates

### Problem

The post-batch dedup pass (after `Promise.all`) only checks title similarity using `dedupConceptSimilarity` (60% word overlap). It does **not** check `location.name`. When two days in the same parallel batch both schedule "Skinlife Wellness Lab" with different title phrasing (e.g., "Afternoon Spa at Skinlife Wellness Lab" vs "Relaxation at Skinlife Wellness Lab"), the title-based similarity can fall below the 60% threshold, and the duplicate passes through undetected.

The per-day validators (`validate-day.ts` and `day-validation.ts`) do check `location.name`, but within a parallel batch, days don't have access to each other's activities as `previousDays` — so the validator never sees the conflict.

### Fix

**File: `supabase/functions/generate-itinerary/generation-core.ts`** — Post-batch dedup pass (~line 2387)

Add a **location-name dedup layer** alongside the existing title-based concept similarity check:

1. Track `seenLocations` (a map of normalized `location.name` → `{ dayNum }`) in addition to the existing `seenConcepts`
2. For each activity, normalize `location.name` and check if it was already seen on a different day
3. If a location match is found, mark the later occurrence for removal (same as the existing title-based path)
4. Skip transport/accommodation categories (same exclusion as existing logic)

```typescript
// Add alongside seenConcepts
const seenLocations = new Map<string, { dayNum: number }>();

// Inside the activity loop, after the title-based check:
const locName = (act.location?.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
if (locName.length > 5 && !match) {
  const locMatch = seenLocations.get(locName);
  if (locMatch && locMatch.dayNum !== day.dayNumber) {
    console.log(`[Stage 2] Cross-batch location dedup: removed "${act.title}" from Day ${day.dayNumber} (same venue "${locName}" on Day ${locMatch.dayNum})`);
    indicesToRemove.push(i);
    dedupCount++;
  } else if (!locMatch) {
    seenLocations.set(locName, { dayNum: day.dayNumber });
  }
}
```

### Why This Fixes the Skinlife Case

- Day 2: "Spa Session at Skinlife Wellness Lab" → `location.name = "Skinlife Wellness Lab"` → added to `seenLocations`
- Day 3: "Skinlife Wellness Lab Relaxation" → `location.name = "Skinlife Wellness Lab"` → **match found** → removed

### Impact
- Single block addition in the existing post-batch dedup loop in `generation-core.ts`
- No changes to other files
- Catches venue duplicates that slip through title-based similarity when titles differ but the physical location is the same

