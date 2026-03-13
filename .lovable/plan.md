

## Active Trip Polish — Round 2

The user raised several issues across the Active Trip view. Here is what needs to change:

### 1. Activity Photos in Today Tab
**File:** `src/pages/ActiveTrip.tsx` (activity cards, ~lines 1049-1220)

Currently activity cards have no images. The `useActivityImage` hook and `SafeImage` component are already used in `LiveItineraryView.tsx` and `EditorialItinerary.tsx`. Add a 56x56 rounded image thumbnail to each activity card (right side), using `useActivityImage` with the activity name, category, existing `imageUrl`, and destination. Create a small wrapper sub-component `ActivityImageThumb` that calls the hook per-activity (hooks can't be called in a loop directly).

### 2. Day Theme with Color Accent
**File:** `src/pages/ActiveTrip.tsx` (~lines 849-876)

The day header currently shows "Farewell — Legacy and Farewells" in plain serif text. Add a subtle color highlight — a warm gradient pill or accent background behind the theme text (e.g., `bg-gradient-to-r from-primary/10 to-primary/5 px-3 py-1 rounded-full inline-block`) to make it visually pop without being garish.

### 3. Inline Route Directions Under Each Activity
**File:** `src/pages/ActiveTrip.tsx` (~lines 1174-1218)

The "Directions" button currently opens external maps. The user wants expandable inline route details (like the `TransitModePicker` on the itinerary page). Add a collapsible "Route" section under each activity's action buttons that:
- Uses the previous activity's location as origin, current activity as destination
- Calls the `route-details` edge function with the activity's `transportationMethod` (walk/transit/drive)
- Displays a compact inline step list (matching `TransitModePicker` Level 2 UI)
- Shows total duration and distance
- Lazy-loads only when expanded

### 4. Cache DNA Briefing Per Day
**File:** `src/components/trips/MidTripDNA.tsx`

Currently fetches fresh AI-generated briefing every time the tab is opened. Add localStorage caching keyed by `tripId + date`. On mount, check cache first — if a briefing exists for today's date, use it immediately. Only fetch from the edge function on cache miss. Store the result in localStorage after successful fetch. This ensures the same briefing persists for the entire day.

### 5. Stats Tab — Less Boring
**File:** `src/components/trips/ActiveTripStats.tsx`

The stat items are visually flat. Improvements:
- Add subtle category-specific color accents to each stat icon (e.g., walking = emerald, memories = pink, meals = amber) instead of uniform `text-muted-foreground/50`
- Add a small progress ring or bar for the completion stat instead of just the number
- Add a "Trip Highlights" mini-section at bottom — show top-rated activities if any feedback exists
- Use slightly larger spacing and a decorative gradient divider between the progress section and stats list

### 6. Journal Notes Persistence Check
**File:** `src/components/trips/ActiveTripNotes.tsx`

The notes already write to the `trip_notes` table (confirmed in code). They are persisted and tied to `trip_id` + `day_number`. This is working correctly — notes are saved and retrievable. No change needed, but we should surface a reassuring "Saved" indicator after writes.

### Files to Edit

| File | Change |
|------|--------|
| `src/pages/ActiveTrip.tsx` | Activity photo thumbnails, day theme color accent, inline expandable route directions |
| `src/components/trips/MidTripDNA.tsx` | localStorage cache by tripId+date |
| `src/components/trips/ActiveTripStats.tsx` | Color accents on icons, visual polish |

