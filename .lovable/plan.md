

## Plan: Modernize Mobile Trip Detail UI

This is a large scope request with 9 changes. I'll break it into **two phases** to keep each implementation manageable and reduce risk. Phase 1 covers the high-priority bug fixes and highest-impact layout changes. Phase 2 covers polish and secondary reorganization.

---

### Phase 1 (This Implementation) — Bugs + Biggest Wins

#### Change 8: Fix Flight Form Field Overlap on Mobile
**File:** `src/components/itinerary/AddBookingInline.tsx`

Replace all instances of `grid grid-cols-2 gap-3` with `grid grid-cols-1 sm:grid-cols-2 gap-3` in the flight form sections (lines 461, 481, 559, 579, 604, 624, 649, 669, 975, 1062). This is a simple find-and-replace across ~10 grid containers. Fields stack vertically on mobile, side-by-side on desktop.

Also apply the same fix in `src/components/itinerary/FlightImportModal.tsx` (lines 511, 532, 553, 574).

#### Change 9: Fix Date Display Overlap in Trip Header
**File:** `src/pages/TripDetail.tsx`

The mobile compact status line (line 1317) and desktop layout (line 1334) are already split with `sm:hidden` / `hidden sm:flex`. Verify no duplicate date pill exists. If the TripDateEditor renders its own date display that overlaps with the status line text, add `[&>span]:hidden` or ensure the TripDateEditor trigger on mobile only shows the pencil icon, not a full date pill.

**File:** `src/components/trip/TripDateEditor.tsx` — Check the trigger element. If it renders a date badge/pill, hide the text on mobile and show only the edit icon.

#### Change 1: Slim Down Hero Area
**File:** `src/pages/TripDetail.tsx`

The hero is already responsive (`h-40 sm:h-56 md:h-72` at line 1279). This is already compact on mobile at 160px. No change needed — already implemented.

#### Change 3: Tab Bar Already Simplified
The tab bar (EditorialItinerary.tsx lines 3665-3739) already has: sticky positioning on mobile, 3 visible tabs (Itinerary, Budget, Details) with Payments and Info in a `⋯` overflow menu via `mobileOverflow: true`. Already implemented.

#### Change 2: MobileTripOverview Already Implemented
Lines 1802-1884 of TripDetail.tsx already wrap Health + Travel Intel in the `MobileTripOverview` collapsible component with localStorage persistence. Already implemented.

#### Change 4: Streamline Trip Summary Action Buttons
**File:** `src/components/itinerary/EditorialItinerary.tsx` (lines ~3812-3960)

- The "Saved ✓" indicator is already a non-button text element (line 3884)
- Wrap the secondary actions row (Optimize, Regenerate — line 3890-3960) in a mobile-only collapsible or move into a `DropdownMenu` with a "More actions" trigger on mobile
- Add `className="hidden sm:flex"` to the secondary actions div, and add a mobile-only `⋯` overflow button that contains the same actions

#### Change 5: Collapse Intelligence Summary on Return Visits
**File:** `src/components/itinerary/ItineraryValueHeader.tsx` (the `ItineraryValueHeader` component rendered at line 3753)

- Add localStorage check keyed by `tripId` for first-visit vs return
- On return visits, collapse to a single summary line showing key stats
- On first visit, show expanded with animation, then mark as seen

#### Change 6: Lighten Day Headers on Mobile
**File:** `src/components/itinerary/EditorialItinerary.tsx` — Find the day header rendering section

- On mobile, move routes/lock/refresh buttons into an overflow `⋯` menu on day headers
- Reduce the large day number styling to compact "DAY X" prefix on mobile
- Truncate VoyanceInsight to single line with expand on mobile

#### Change 7: Add Breathing Room
**File:** `src/components/itinerary/EditorialItinerary.tsx`

- Increase `space-y-6` to `space-y-8` on mobile for major sections
- Add `p-4` instead of `p-3` inside activity cards on mobile
- Reduce box shadows on nested cards (VoyanceInsight inside activity)

---

### Summary of Actual Code Changes Needed

| File | Changes |
|------|---------|
| `src/components/itinerary/AddBookingInline.tsx` | Replace ~10 `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| `src/components/itinerary/FlightImportModal.tsx` | Replace ~4 `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` |
| `src/components/trip/TripDateEditor.tsx` | Hide date text on mobile trigger, show only pencil icon |
| `src/components/itinerary/EditorialItinerary.tsx` | Collapse secondary action buttons on mobile into overflow menu; lighten day headers on mobile; add spacing; truncate VoyanceInsight on mobile |
| `src/components/itinerary/ItineraryValueHeader.tsx` | Add localStorage-based auto-collapse on return visits |

### What's Already Done (No Changes Needed)
- Change 1 (slim hero): Already `h-40` on mobile
- Change 2 (MobileTripOverview): Already collapsible with localStorage
- Change 3 (tab bar): Already 3 tabs + overflow on mobile

### Risk Assessment
- **Low risk**: Flight form grid fix is a class-name-only change
- **Low risk**: Header overlap fix is CSS/conditional rendering
- **Medium risk**: EditorialItinerary changes touch a large file but are additive (wrapping existing elements in responsive containers)

