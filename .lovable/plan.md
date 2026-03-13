

## Make Active Trip View More Editorial

### What You Want
The live trip page (`/trip/:id/active`) should feel like the editorial itinerary (magazine-style typography, serif headings, timeline flow) instead of the current dashboard-card layout. Keep all existing features (check-in, feedback, directions, voice notes, smart swap, rescue, media capture, etc.) but wrap them in editorial styling. Also: show selected routes inline, and add a text notes input alongside voice notes.

### Current State
- **ActiveTrip.tsx** (1117 lines): Dashboard-style with plain `Card` components, sans-serif headings, flat activity list
- **EditorialItinerary.tsx** (9688 lines): Magazine-style with serif typography (`font-serif`), large day numbers (`text-5xl`), timeline dots, time-of-day section headers (Morning/Afternoon/Evening), `DayRouteMap` integration, transit badges
- **TripNotes component** exists in `src/components/post-trip/TripNotes.tsx` using the `trip_notes` table — can be reused for live notes
- **DayRouteMap** and **TransitNavigation** components exist but aren't used in ActiveTrip

### Plan

**File: `src/pages/ActiveTrip.tsx` — Restyle TodayView**

1. **Editorial day header**: Replace the plain "Today's Schedule" heading with the editorial pattern — large serif day number (`01`, `02`), serif day title/theme, italic description, date badge, weather pill. Mirror the `EditorialItinerary` day header style.

2. **Time-of-day section headers**: Group activities under "Morning", "Afternoon", "Evening" dividers (same logic as EditorialItinerary lines 8162-8182) with the `text-[10px] font-bold uppercase tracking-widest text-primary/60` style and gradient line.

3. **Editorial activity cards**: Restyle each activity card in TodayView:
   - Serif font for activity name (`font-serif text-lg font-medium`)
   - Timeline dot and vertical line on the left (matching EditorialItinerary's mobile timeline pattern)
   - Keep all existing functional elements (check-in, directions, inline rating, voice note player, media capture, confirmation numbers, tips) but move them into the editorial card layout
   - Show Voyance tips in the editorial pull-quote style (italic, left border accent)

4. **NOW context card**: Keep the pulsing "NOW" indicator but restyle with serif typography and softer gradient, matching editorial palette.

5. **Inline route map**: Add `DayRouteMap` component below the day header (imported from `./DayRouteMap`), passing today's activities. Show by default (collapsible). Add `TransitNavigation` badges between consecutive activities when transport details are available.

6. **Text notes section**: Add an inline notes area per-day in the TodayView:
   - Quick-add text input (Textarea) at the bottom of the activity list
   - Uses the existing `trip_notes` table with `day_number` set to current day
   - Shows existing notes for today below the input
   - Note type selector (memory, tip, discovery, saved_place) using the existing `NOTE_TYPES` from TripNotes
   - Keep voice note button alongside — both options available

7. **Overview tab editorial treatment**: When viewing the "Trip" (overview) tab, also apply editorial day headers and typography to the `TripOverview` component for consistency.

### Files to Change

| File | Change |
|------|--------|
| `src/pages/ActiveTrip.tsx` | Restyle TodayView with editorial typography, timeline, time-of-day headers, route map, inline text notes |
| `src/components/trips/ActiveTripNotes.tsx` | **New** — Lightweight inline notes component for live trip (reads/writes `trip_notes` table, filtered by day) |

### No Database Changes
The `trip_notes` table already exists with `trip_id`, `day_number`, `note_type`, `content`, `location`, and `created_at` fields — exactly what's needed.

### What Stays the Same
All existing features remain: check-in, inline rating, voice notes, smart swap, rescue banner, media capture, confirmation numbers, nearby tab, memories tab, stats tab, DNA tab, chat tab, daily briefing, progress bar, feedback overlays.

