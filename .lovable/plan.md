

## Fix: Cross-Day Restaurant Deduplication

### Problem
Restaurants repeat across days (33% repetition rate) because:
1. **Extraction filter too strict**: Only `act.category === 'dining'` is checked when building the used-restaurants blocklist. Venues categorized differently (e.g., `'shopping'` for a bakery) are missed.
2. **No post-generation enforcement**: The blocklist is only advisory in the AI prompt. If the AI ignores it, repeated restaurants pass through unchallenged.
3. **No fallback replacement**: When a repeat is detected, there's no mechanism to swap it with an unused restaurant from the pool.

### Changes

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

#### Change 1: Broaden restaurant extraction filter (lines 1232-1241)
Expand the dining detection from `act.category === 'dining'` to also catch activities with meal-related titles or types, matching the user's suggested pattern:
```typescript
// Before: only act.category === 'dining'
// After: also catch by title pattern and type field
const isDining = (act.category || '').toLowerCase() === 'dining' 
  || (act.type || '').toLowerCase() === 'dining'
  || /\b(?:breakfast|brunch|lunch|dinner|supper|cocktails|tapas)\b/i.test(act.title || '');
```

#### Change 2: Add post-generation restaurant dedup enforcement (after day generation, before save)
After the day result is returned from `action-generate-day.ts` and before saving, add a hard dedup check that replaces any restaurant matching the blocklist with an unused one from the pool:

```typescript
// POST-GENERATION: Enforce cross-day restaurant uniqueness
if (usedRestaurants.length > 0) {
  const { extractRestaurantVenueName } = await import('./generation-utils.ts');
  const usedNorm = new Set(usedRestaurants.map(n => extractRestaurantVenueName(n)));
  const activities = dayResult?.activities || [];
  
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const isDining = /* same broadened check */;
    if (!isDining) continue;
    
    const venue = extractRestaurantVenueName(act.title || '') 
      || extractRestaurantVenueName(act.location?.name || '');
    if (!venue || !usedNorm.has(venue)) continue;
    
    // Find replacement from pool
    const replacement = restaurantPool.find(r => {
      const rNorm = extractRestaurantVenueName(r.name || '');
      return rNorm && !usedNorm.has(rNorm) && /* match meal type */;
    });
    
    if (replacement) {
      console.warn(`[generate-trip-day] 🔄 CROSS-DAY DEDUP: Replaced "${act.title}" with "${replacement.name}"`);
      act.title = replacement.name;
      act.location = { name: replacement.name, address: replacement.address || '' };
      usedNorm.add(extractRestaurantVenueName(replacement.name));
    } else {
      console.warn(`[generate-trip-day] ⚠️ CROSS-DAY DEDUP: "${act.title}" repeats but no replacement available`);
    }
  }
}
```

This goes after the `dayResult` is assembled (around line 860) and before the save at line 862+.

#### Change 3: Add logging to confirm blocklist state
Add a log line when `usedRestaurants` is loaded to confirm it contains expected values:
```typescript
if (usedRestaurants.length > 0) {
  console.log(`[generate-trip-day] 🍽️ Restaurant blocklist (${usedRestaurants.length}): ${usedRestaurants.join(', ')}`);
}
```

### Files
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — broaden extraction filter, add post-generation dedup enforcement, add blocklist logging

