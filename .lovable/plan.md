

## Fix 21: Edit/Preview Mode Toggle for Trip Page

### Overview
Add an Edit/Preview toggle to the trip page. Edit mode = current view (everything). Preview mode = clean, magazine-style reading view with all builder tools hidden. No features removed — Preview simply hides editing controls.

### Scope Assessment
This is a **large** change touching the two most complex files in the app:
- `TripDetail.tsx` (2635 lines) — top-level trip page
- `EditorialItinerary.tsx` (9400 lines) — the main itinerary component with DayCard and ActivityRow sub-components

Given the size, we'll implement this **incrementally across multiple messages** to avoid errors:
1. **Part A**: Mode context, toggle UI, TripDetail-level conditional rendering
2. **Part B**: EditorialItinerary + DayCard preview mode rendering
3. **Part C**: ActivityRow preview card redesign + route map integration
4. **Part D**: Polish — transitions, mobile, URL state, print

---

### Part A: Mode Context & TripDetail Integration

**New file: `src/hooks/useTripViewMode.ts`**
- Custom hook wrapping `useSearchParams` to read/write `?mode=edit|preview`
- Returns `{ mode, setMode, isPreview, isEditMode }`
- Defaults: trip owner → `edit`, non-owner/shared view → `preview`
- Uses `history.replaceState` via `setSearchParams(..., { replace: true })` to avoid navigation history pollution

**New file: `src/components/trip/TripViewModeToggle.tsx`**
- Segmented control: "Edit" | "Preview"
- Active segment: `bg-teal-700 text-white`, inactive: `bg-white text-gray-600 border`
- Pill shape: `rounded-full`, 200ms transition
- Only shown to trip owner (or collaborators with edit access)
- Non-owners locked to preview — toggle hidden entirely

**`TripDetail.tsx` changes:**
- Import `useTripViewMode` and `TripViewModeToggle`
- Derive `isOwner` from `user?.id === trip.user_id`
- Non-owners: force preview mode, hide toggle
- Pass `viewMode` to `EditorialItinerary` as new prop `viewMode: 'edit' | 'preview'`
- When `isPreview`:
  - Hide: Draft badge, MobileTripOverview, GuidePromptBanner, TripDebriefModal trigger
  - Hide: TripPhotoGallery's upload button (keep gallery visible)
  - Hide: ItineraryAssistant floating chatbot
  - Keep: Hero image, trip title (without draft badge), day selector, toggle
- Shared links (`/trip/{id}` from Share button): append `?mode=preview` — recipients land in clean view

### Part B: EditorialItinerary Preview Mode

**`EditorialItinerary.tsx` changes:**
- New prop: `viewMode?: 'edit' | 'preview'` (default `'edit'`)
- Derive `isCleanPreview = viewMode === 'preview'` (distinct from existing `isPreview` which means "locked/paywall preview")
- When `isCleanPreview`:
  - **Hide the entire "Trip Command Center" card** (ROW 1-5: Trip Total, action buttons, Voyance Intelligence, Trip Completion, Travel Intel) — replace with just the toggle
  - **Hide tab bar** — only show itinerary content (no Budget, Details, Need to Know, Group tabs)
  - **Hide**: SmartFinishBanner, WhyWeSkippedSection, ParsedTripNotesSection, skip list warnings, FlightSyncWarning, BulkUnlockBanner, UnlockBanner, CreditNudge
  - **Hide**: Undo button, History button, date editor pencil
  - **Keep**: Day navigation bar (day picker), day selector arrows
  - **Keep**: TripViewModeToggle (rendered at top of the itinerary area)
  - Pass `isCleanPreview` down to `DayCard`

**`DayCard` changes when `isCleanPreview`:**
- **Hide**: Cost badge, lock/unlock button, regenerate button, collapse/expand chevron, overflow menu
- **Keep**: Day number + title with teal accent bar, weather badge, "Show Routes" button (for map)
- Day is **always expanded** in preview — no collapse behavior
- **Hide**: Day footer entirely (Add, Discover, Import, Refresh, Day Total)
- **Hide**: TransitGapIndicator between activities
- **Hide**: Inline "Add activity" insertion points
- **Hide**: Transport comparison cards on transition days

### Part C: ActivityRow Preview Card Redesign

**`ActivityRow` changes when `isCleanPreview`:**
- Render a **completely different card layout** — not the edit card with things removed, but a clean reading card:

```
┌───────────────────────────────────────────┐
│  9:45 AM - 6:00 PM           (teal text)  │
│                                           │
│  [Image — full card width, 200px height]  │
│                                           │
│  US Open Tennis Tournament    (Playfair)  │
│  A full day of world-class tennis...      │
│                                           │
│  📍 Flushing Meadows, Flushing, NY        │
│                                           │
│  VOYANCE TIP                              │
│  Visit the Heineken Silver Shop...        │
└───────────────────────────────────────────┘
```

- Time: `text-sm font-medium text-teal-700`
- Image: full card width, `rounded-t-xl`, `h-[200px]`, `object-cover`, no edit overlay. Uses existing `useActivityImage` hook.
- Title: `font-serif text-xl font-semibold text-gray-900`
- Description: `text-base text-gray-700 leading-relaxed`
- Location: `text-sm text-gray-500` with subtle `MapPin` icon (Lucide, not emoji)
- Tip: Always expanded. Label "VOYANCE TIP" in `text-xs font-medium text-teal-600 uppercase tracking-wider`. Body in `text-sm text-gray-600 italic`.
- **Hidden**: Category badge, star rating, price, booking buttons, lock icon, 3-dot menu, drag handle, image edit pencil, vendor booking links, reservation badges

**Card styling in preview:**
- `border-0 shadow-none bg-transparent` — content floats on page
- Separated by `mb-8` whitespace (generous breathing room)
- Images get `rounded-xl` as the primary visual anchor

**Transport items**: Completely hidden in preview. No transport line items, no connectors. Activities flow directly with whitespace.

### Part D: Route Map, Transitions, Mobile, URL

**Route Map (simplified v1):**
- The existing `DayRouteMap` component already renders a Leaflet map when "Show Routes" is clicked
- In preview mode: "Show Routes" remains available and works as-is
- Future enhancement: side-by-side layout on desktop. For now, the existing stacked map is sufficient.
- No new map integration needed for v1.

**Transitions:**
- When toggling: use `opacity` transitions (200ms) on the elements being shown/hidden
- Scroll position preserved — no jump to top
- Day selector stays fixed — user stays on whichever day they were viewing

**URL State:**
- `?mode=preview` / `?mode=edit` via `useSearchParams`
- Toggle updates URL without full reload via `{ replace: true }`
- Share button appends `?mode=preview` to shared links

**Mobile:**
- Toggle full-width on mobile: `w-full sm:w-auto`
- Preview cards go full-width with minimal padding
- Timeline dots/lines hidden in preview mode on mobile (cleaner reading)

**Non-owner behavior:**
- Non-owners (shared view, no edit access): locked to preview, toggle hidden
- Collaborators with edit permission: see toggle, can switch
- Non-members in preview: subtle "Plan your own trip →" CTA at bottom

### Files Changed

| File | Action |
|------|--------|
| `src/hooks/useTripViewMode.ts` | **Create** — mode hook |
| `src/components/trip/TripViewModeToggle.tsx` | **Create** — segmented toggle |
| `src/pages/TripDetail.tsx` | **Edit** — integrate toggle, conditional rendering |
| `src/components/itinerary/EditorialItinerary.tsx` | **Edit** — hide command center/tabs/tools in preview |
| `src/components/itinerary/EditorialItinerary.tsx` (DayCard) | **Edit** — simplified day header, always expanded |
| `src/components/itinerary/EditorialItinerary.tsx` (ActivityRow) | **Edit** — clean preview card variant |

### No Database Changes
This is a UI-only feature. No schema modifications needed.

