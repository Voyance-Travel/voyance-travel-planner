

## Editorial Polish for Active Trip View

The user wants 7 specific improvements to the ActiveTrip page (`/trip/:id/active`). Here's what each tab currently looks like and what needs to change:

### 1. Today Tab — Add hero photo at top
**File:** `src/pages/ActiveTrip.tsx` (TodayView, ~line 809-830)

Currently: jumps straight into DailyProgressBar → editorial day header. No imagery.

**Change:** Add a hero image section at the top of TodayView, above the progress bar. Use `useTripHeroImage` (already used elsewhere) to get the trip's cached hero photo, displayed as a 200px-tall rounded image with a subtle gradient overlay showing the day theme. This gives the "Today" tab an immediate visual anchor.

### 2. Today Tab — Directions should use chosen transport mode
**File:** `src/pages/ActiveTrip.tsx` (~line 1152-1167)

Currently: the "Directions" button calls `openMapLocation()` which opens Apple/Google Maps with no transport mode preference — just a pin.

**Change:** Pass the activity's transit/transport context to the Directions button. The itinerary data already contains transit items between activities with `transportMode` info. When the user taps "Directions," use the chosen transport mode (walk, transit, drive) as a parameter to `openMapLocation` or construct the maps URL with the `dirflg` parameter (w=walking, r=transit, d=driving). This requires:
- Reading the transit item *before* each activity from `todaysItinerary.activities` to find the chosen mode
- Updating `openMapLocation` in `src/utils/mapNavigation.ts` to accept an optional `travelMode` parameter and append it to the Maps URL

### 3. Notes — Support text notes, not just voice
**File:** `src/components/feedback/InlineActivityRating.tsx` (~line 89-99)

Currently: the "Note" button next to ratings only triggers `onVoicePress` which opens voice recording. There's no way to write a text note inline.

**Change:** Add a text note option alongside the voice button. Replace the single `Mic` + "Note" button with two options:
- `Mic` icon for voice note (existing behavior)
- `PenLine` icon for text note (opens a small inline textarea or navigates to `ActiveTripNotes` with pre-filled activity context)

Alternatively, the simpler approach: make the "Note" button open a small popover/sheet with two options — "Voice note" and "Write a note" — so users choose their preferred input method.

### 4. Trip (Overview) Tab — Editorial restyle
**File:** `src/components/trips/TripOverview.tsx`

Currently: uses generic `Card`/`CardContent`, sans-serif headers, standard `Tabs` component. Feels dashboard-like.

**Change:** Apply editorial treatment:
- Header: `font-serif` for destination name (already done), but add a thin gradient divider below
- Day progress cards: Replace grid of `Card` components with editorial timeline-style day list — large serif day numbers (`01`, `02`), italic theme descriptions, small completion indicator
- Reservations: Serif headings, pull-quote style for vendor names, remove heavy card borders in favor of subtle left-border accent lines
- Remove `Tabs` component, use the same `text-[10px] font-bold uppercase tracking-widest` section headers with gradient dividers used in TodayView

### 5. Nearby Tab — Editorial restyle
**File:** `src/components/trips/WhatsNearby.tsx`

Currently: generic `Card` components, sans-serif `font-semibold` header, basic category grid.

**Change:**
- Header: Replace `<h3 className="font-semibold">What's Nearby</h3>` with `font-serif text-xl font-semibold`
- Category pills: Replace blocky grid with rounded-full pill buttons (matching transport mode picker pattern)
- Suggestion cards: Replace `Card`/`CardContent` with lighter editorial cards — serif name, italic `whyForYou` as a pull-quote with left border, remove heavy card borders
- Add section header "Curated for You" with `tracking-widest uppercase` style

### 6. Stats Tab — Editorial restyle
**File:** `src/components/trips/ActiveTripStats.tsx`

Currently: `Card`/`CardContent` grid with colored icon boxes. Feels like a dashboard widget.

**Change:**
- Header: Replace `<h2 className="text-lg font-bold">Trip Stats</h2>` with `font-serif text-xl` and add italic subheading
- Trip completion: Replace Card wrapper with borderless section, serif label
- Stats grid: Replace Card wrappers with minimal editorial blocks — no heavy shadows, use thin bottom borders between items instead of card borders. Large serif values, small uppercase labels with tracking
- Overall: more whitespace, fewer visual containers

### 7. DNA (Today's Briefing) Tab — Editorial restyle
**File:** `src/components/trips/MidTripDNA.tsx`

Currently: generic `Card`/`CardContent` for weather, schedule, highlights, don't-miss. Sans-serif throughout.

**Change:**
- Header: `font-serif text-xl` for "Today's Briefing"
- Weather card: Remove Card wrapper, use borderless section with large serif temperature, italic weather tip
- Schedule: Serif heading, subtle left-border accent
- Highlights: Replace Card wrappers with pull-quote style — left border accent, serif title, italic reason
- Don't Miss: Replace Card with accent-bordered editorial blocks
- Add thin gradient dividers between sections

### Files to Edit

| File | Change |
|------|--------|
| `src/pages/ActiveTrip.tsx` | Hero photo at top of Today; transport-aware Directions button |
| `src/utils/mapNavigation.ts` | Accept optional `travelMode` param |
| `src/components/feedback/InlineActivityRating.tsx` | Add text note option alongside voice |
| `src/components/trips/TripOverview.tsx` | Editorial restyle — serif fonts, timeline days, remove heavy cards |
| `src/components/trips/WhatsNearby.tsx` | Editorial restyle — serif header, pill categories, lighter cards |
| `src/components/trips/ActiveTripStats.tsx` | Editorial restyle — serif values, minimal containers |
| `src/components/trips/MidTripDNA.tsx` | Editorial restyle — serif headings, pull-quote highlights, no heavy cards |

