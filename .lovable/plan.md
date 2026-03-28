

## Fix: Geographic Impossibilities in Generated Itineraries

### Problem

Three distinct failures produce geographically impossible itineraries:

1. **Transport destinations don't match next activity** — AI generates "Metro to Omotesando" but the next activity is in Roppongi. The bookend validator (line 11148-11157) creates transport cards using `next.location?.name` which is the AI-generated (potentially wrong) name, and AI-generated transport cards use hallucinated destinations.

2. **Activities scattered across far-apart neighborhoods** — Asakusa → Ebisu → Sumida requires 10km+ hops, but Stage 3.5 geographic validation runs *before* enrichment (Stage 4) adds coordinates. Most activities lack GPS data at that point, so reordering is ineffective.

3. **Activity name doesn't match its actual location** — "Fine Dining at Ginza Toyoda" is actually located at a Kagurazaka address. The AI conflates venue names from different neighborhoods.

### Root Causes

| Issue | Root Cause |
|-------|-----------|
| Transport mismatch | No post-enrichment pass syncs transport titles with next activity's verified location |
| Neighborhood scattering | Stage 3.5 reorder runs pre-enrichment; Stage 4.9 auto-route optimizer exists but transport cards aren't updated to match |
| Name/location mismatch | No cross-check between verified Place data and AI-generated venue names |

### Fix — Three New Stages in `index.ts`

All three are added after Stage 4.9 (auto route optimization), where activities have verified coordinates and enriched location data.

**Stage 4.92: Post-enrichment geographic reorder**

Re-run `reorderActivitiesOptimally` after enrichment, now that activities have verified GPS coordinates. This catches the Asakusa→Ebisu→Sumida pattern by clustering geographically proximate activities.

```typescript
// After Stage 4.9, ~line 7393
// STAGE 4.92: Post-enrichment geographic reorder
for (let dayIdx = 0; dayIdx < enrichedDays.length; dayIdx++) {
  const day = enrichedDays[dayIdx];
  const activitiesWithLocation = day.activities.map(act => ({
    id: act.id, title: act.title || act.name || '',
    coordinates: act.location?.coordinates,
    neighborhood: act.location?.address?.split(',')[0],
    isLocked: isTimeFixed(act), // reuse from auto-route-optimizer
    category: act.category,
  }));
  
  const dayAnchor = determineDayAnchor(activitiesWithLocation, undefined, hotelNeighborhood, cityZones);
  const validation = validateDayGeography(activitiesWithLocation, dayAnchor, travelConstraints, cityZones);
  
  if (!validation.isValid) {
    const reordered = reorderActivitiesOptimally(activitiesWithLocation, dayAnchor);
    const reorderedIds = reordered.map(a => a.id);
    // Preserve original time slots, just reorder activities
    const originalTimes = day.activities.map(a => ({ startTime: a.startTime, endTime: a.endTime }));
    day.activities = day.activities.sort((a, b) => {
      const aIdx = reorderedIds.indexOf(a.id);
      const bIdx = reorderedIds.indexOf(b.id);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
    // Reassign original time slots to reordered activities
    day.activities.forEach((act, i) => {
      if (originalTimes[i]) {
        act.startTime = originalTimes[i].startTime;
        act.endTime = originalTimes[i].endTime;
      }
    });
  }
}
```

**Stage 4.93: Name-location cross-check**

For activities where Google Places verification returned a `placeId` and coordinates, check if the verified neighborhood matches the activity title. If "Ginza" is in the title but verified address is in Kagurazaka, strip the incorrect neighborhood from the title.

```typescript
// STAGE 4.93: Name-location mismatch detection
for (const day of enrichedDays) {
  for (const act of day.activities) {
    if (!act.verified?.placeId || !act.location?.address) continue;
    const title = (act.title || '').toLowerCase();
    const address = (act.location.address || '').toLowerCase();
    // Check if title contains a neighborhood name that contradicts the address
    const TOKYO_NEIGHBORHOODS = ['ginza','shibuya','shinjuku','asakusa','roppongi',
      'omotesando','ebisu','akihabara','ueno','ikebukuro','sumida','kagurazaka','otemachi'];
    const titleNeighborhood = TOKYO_NEIGHBORHOODS.find(n => title.includes(n));
    const addressNeighborhood = TOKYO_NEIGHBORHOODS.find(n => address.includes(n));
    if (titleNeighborhood && addressNeighborhood && titleNeighborhood !== addressNeighborhood) {
      // Mismatch: strip the wrong neighborhood from title
      const re = new RegExp(`\\b${titleNeighborhood}\\b`, 'gi');
      act.title = (act.title || '').replace(re, addressNeighborhood.charAt(0).toUpperCase() + addressNeighborhood.slice(1));
      console.log(`[Stage 4.93] Fixed name-location mismatch: "${title}" → address is in ${addressNeighborhood}, not ${titleNeighborhood}`);
    }
  }
}
```

**Stage 4.95: Transport title consistency**

After all reordering is done, iterate every transport card and sync its destination with the next non-transport activity's location.

```typescript
// STAGE 4.95: Sync transport card destinations with next activity
for (const day of enrichedDays) {
  for (let i = 0; i < day.activities.length; i++) {
    const act = day.activities[i];
    if ((act.category || '').toLowerCase() !== 'transport') continue;
    
    // Find next non-transport activity
    let nextAct = null;
    for (let j = i + 1; j < day.activities.length; j++) {
      if ((day.activities[j].category || '').toLowerCase() !== 'transport') {
        nextAct = day.activities[j];
        break;
      }
    }
    if (!nextAct) continue;
    
    const nextLocationName = nextAct.location?.name || nextAct.title || '';
    if (!nextLocationName) continue;
    
    // Extract transport mode from current title
    const modeMatch = (act.title || '').match(/^(taxi|metro|walk|train|bus|ferry|uber|rideshare|drive)\s+to\b/i)
      || (act.title || '').match(/^travel\s+to\s+.+\s+via\s+(.+)$/i);
    
    if (modeMatch) {
      const mode = modeMatch[1] || 'Travel';
      act.title = `${mode.charAt(0).toUpperCase() + mode.slice(1)} to ${nextLocationName}`;
    } else if ((act.title || '').toLowerCase().startsWith('travel to')) {
      act.title = `Travel to ${nextLocationName}`;
    }
    
    // Also sync transport card's location to destination
    act.location = { ...act.location, name: nextLocationName, address: nextAct.location?.address || '' };
    if (nextAct.location?.coordinates) {
      act.location.coordinates = nextAct.location.coordinates;
    }
  }
}
```

### Result

| Before | After |
|--------|-------|
| Asakusa → Ebisu (10km) → Sumida — scattered | Clustered: Asakusa → Sumida → Skytree (nearby) |
| "Metro to Omotesando" → next activity in Roppongi | "Metro to Seryna Mon Cher Ton Ton" (Roppongi) |
| "Fine Dining at Ginza Toyoda" at Kagurazaka address | "Fine Dining at Kagurazaka Toyoda" |
| "Taxi to Nezu Museum" → next is Acupuncture in Omotesando | "Taxi to Acupuncture & Tea Wellness" |

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Add Stages 4.92, 4.93, 4.95 after Stage 4.9 |

