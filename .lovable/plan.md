

## Fix Meal Type Leakage in Venue Names

### Problem
AI appends meal-type words ("Breakfast", "Lunch", "Dinner") to `venue_name` fields (e.g., "Pavilhão Carlos Lopes Breakfast"). This propagates to travel routing destinations. Activity titles are clean but the underlying venue data is corrupted.

### Plan (1 file)

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

**Change 1: Add `cleanVenueNameMealLeakage` helper** (before `sanitizeGeneratedDay`, around line 230)

```typescript
const MEAL_TYPE_SUFFIX_RE = /\s+(?:Breakfast|Lunch|Dinner|Brunch|Supper|Dessert|Snack)\s*$/i;

function cleanVenueNameMealLeakage(name: string): string {
  if (!name || !MEAL_TYPE_SUFFIX_RE.test(name)) return name;
  const cleaned = name.replace(MEAL_TYPE_SUFFIX_RE, '').trim();
  if (cleaned.length < 3) return name; // protect names like "Dear Breakfast"
  console.warn(`VENUE NAME LEAKAGE FIX: "${name}" → "${cleaned}"`);
  return cleaned;
}
```

**Change 2: Apply to venue fields in the activity loop** (after line 281, where `venue_address` is sanitized)

Add cleanup for `venue_name` and `restaurant.name`:
```typescript
if (act.venue_name) act.venue_name = cleanVenueNameMealLeakage(act.venue_name);
if (act.restaurant?.name) act.restaurant.name = cleanVenueNameMealLeakage(act.restaurant.name);
```

**Change 3: Apply to travel routing destinations** (after the activity loop ends, before existing travel routing logic or at the end of `sanitizeGeneratedDay`)

```typescript
if (Array.isArray(day.travelRouting)) {
  day.travelRouting.forEach((route: any) => {
    if (route.destination) route.destination = cleanVenueNameMealLeakage(route.destination);
    if (route.to) route.to = cleanVenueNameMealLeakage(route.to);
  });
}
```

Also apply to transit activity titles that embed venue names (the "Travel to X Breakfast" pattern) — the existing transit title cleanup on line 304 already strips "Breakfast at" from "Travel to Breakfast at X", but doesn't catch "Travel to X Breakfast". Add after line 308:
```typescript
// Strip trailing meal-type from transit destinations
act.title = act.title.replace(/^((?:Travel|Walk|Metro|Bus|Tram|Taxi|Train|Drive|Ride|Ferry)\s+to\s+.+?)\s+(?:Breakfast|Lunch|Dinner|Brunch)\s*$/i, '$1');
```

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts`

### Verification
Generate a 4-day Lisbon trip. Confirm no venue_name fields have trailing meal-type words, travel routing is clean, and restaurants named with meal words (e.g., "Dear Breakfast") are preserved.

