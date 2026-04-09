

# Fix `parseUserActivities` for Real-World Itinerary Formats

## Problem
The current parser has several gaps that would cause this itinerary to lose structure:

1. **Tilde times**: `~7:15 AM` — the `~` prefix isn't handled, so the time won't parse
2. **En-dash vs hyphen**: User uses `–` (en-dash) throughout, but the regex only matches `-` (hyphen) for time ranges like `5:30 PM – 6:30 PM`
3. **Vague time periods**: `Morning – Breakfast`, `Afternoon – Villa check-in`, `Evening – Dinner`, `Night – Pool` have no numeric time — these become timeless locked cards with no slot in the timeline
4. **Venue extraction misses dash pattern**: `Dinner – Comptoir Darna` and `Transfer – Radisson Blu` use `–` as separator, but the venue regex only matches `at ` or `@ `. Most venues in this itinerary would NOT be extracted
5. **Departure/arrival entries**: `1:00 PM – Leave for airport`, `6:15 AM – Land` need flight-related category detection

## Changes

### 1. Normalize en-dashes before parsing
**File: `compile-prompt.ts` → `parseUserActivities()`**

Add a pre-processing step at the top to replace all en-dashes `–` and em-dashes `—` with hyphens `-` in the input string before splitting and regex matching.

### 2. Handle tilde-prefixed times
**File: `compile-prompt.ts` → time regex**

Update the time-matching regex to optionally accept a leading `~` or `≈` prefix (strip it before normalizing). `~7:15 AM` should parse to `07:15`.

### 3. Map vague time periods to approximate times
**File: `compile-prompt.ts` → `parseUserActivities()`**

After the time regex fails, check for period-prefixed entries like `Morning - Activity`. Map to approximate start times:
- `Morning` → `08:00` (or `09:00` if not first entry)
- `Afternoon` → `14:00`
- `Evening` → `18:00`
- `Night` → `21:00`
- `Day` → `10:00`

This ensures locked cards get timeline positions.

### 4. Expand venue extraction to catch dash-separated names
**File: `compile-prompt.ts` → venue extraction regex**

Update the venue match from `(?:at |@ )(.+)$` to also catch the pattern `Activity - VenueName` when the activity text contains a dash separator after a known activity word (Dinner, Lunch, Breakfast, Spa, Transfer, Drinks, etc.):
```
Dinner - Comptoir Darna  →  venue_name = "Comptoir Darna"
Spa - Four Seasons       →  venue_name = "Four Seasons"
Transfer - Radisson Blu  →  venue_name = "Radisson Blu"
```

### 5. Expand category detection
**File: `compile-prompt.ts` → `detectActivityCategory()`**

Add missing keywords:
- `flight|depart|land|airport|lounge` → `transit`
- `drinks|cocktail|wine|bar` → `dining`
- `coffee` → `dining`
- `wake|get ready|freshen` → `activity`
- `train|transfer|arrive|depart` → `transit`
- `wine tasting` → `activity`
- `session|panel` → `activity`

### 6. Deploy
Deploy `generate-itinerary` edge function.

## What's NOT Changed
- Chat-trip-planner extraction prompt (it already instructs the AI to comma-separate with times)
- Lock/Enhance/Verify pipeline logic
- Merge, filter bypass, and verify phases
- Database schema

