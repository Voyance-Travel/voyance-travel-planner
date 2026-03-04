

## Plan: Modernize Mobile Trip Detail UI

This is a large codebase with most changes already partially implemented from previous rounds. The key remaining work focuses on polishing the mobile experience across 3 files.

### What's Already Done
- Hero height reduced to `h-40` on mobile (Change 1) ✅
- Compact status line on mobile ✅
- MobileTripOverview wrapping Health + Travel Intel with localStorage collapse ✅
- Tab bar has overflow menu for Payments/Info on mobile ✅
- ItineraryValueHeader auto-collapses on return visits ✅
- Action buttons have primary/secondary split ✅
- Day headers hide description on mobile ✅

### What Still Needs Work

#### 1. Make Tab Bar Sticky on Mobile (`EditorialItinerary.tsx`, ~line 3650)
The tab bar container needs `sticky top-0 z-30` on mobile so users can always switch tabs while scrolling through long itineraries. Currently it scrolls away.

**Lines ~3650-3660**: Add `sm:relative sm:top-auto` to keep desktop unchanged, add `sticky top-0 z-30 bg-background` for mobile.

#### 2. Compact Day Number in DayCard on Mobile (`EditorialItinerary.tsx`, ~line 7205-7215)
The large `text-5xl` day number (`01`, `02`) takes excessive space on mobile. Change to `text-xl` on mobile with `sm:text-5xl` for desktop. The padded "01" format is fine on desktop but on mobile use "DAY 1" prefix style.

**Lines ~7208-7213**: Change `text-xl sm:text-5xl` and conditionally show "DAY" prefix on mobile vs the large numeral on desktop.

#### 3. Move Day Action Buttons to Overflow Menu on Mobile (`EditorialItinerary.tsx`, ~line 7242-7347)
Currently the day header shows: price badge, weather, Routes button, Lock button, Regenerate button, Collapse chevron — all inline. On mobile this overflows. Move Lock, Regenerate, and Routes into a `DropdownMenu` "⋯" button on mobile, keeping only price badge + weather + collapse chevron visible.

**Lines ~7242-7347**: Wrap Lock/Regenerate/Routes in `hidden sm:flex` and add a mobile-only `DropdownMenu` with those actions.

#### 4. VoyanceInsight Truncation on Mobile
The VoyanceInsight paragraphs in activity cards show full text. On mobile, truncate to 1 line with "..." expand. This is in the `ActivityRow` component or `VoyanceInsight` component.

Search for the `VoyanceInsight` component usage in ActivityRow and add `line-clamp-1 sm:line-clamp-none` with click-to-expand.

#### 5. Increase Spacing Between Activity Cards (`EditorialItinerary.tsx`)
Activity cards feel cramped. The `DraggableActivityList` renders items with minimal gap. Add `space-y-3 sm:space-y-4` to the activity list container for more breathing room.

#### 6. Fix Flight Date Boxes Overlapping on Mobile (`SortableFlightLegCards.tsx`)
The flight card header row (line ~133-161) uses `flex items-center justify-between` with badges and airport displays that can overlap on narrow screens. Add `flex-wrap gap-2` and ensure the route visualization (line ~164-189) stacks properly on very narrow screens.

**Lines ~133-161 and ~164-189**: Add `flex-wrap gap-2` to header, and add responsive `flex-col sm:flex-row` to route visualization for very narrow screens.

#### 7. Visual Polish — Reduce Border/Shadow Noise
- DayCard: Change `shadow-sm hover:shadow-md` to `shadow-none sm:shadow-sm sm:hover:shadow-md` on mobile (line ~7189)
- Activity cards within days: reduce double-border effect by using subtler dividers
- ItineraryValueHeader expanded: reduce padding on mobile

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/itinerary/EditorialItinerary.tsx` | Sticky tab bar; compact day number; day action overflow menu; activity spacing; DayCard shadow reduction |
| `src/components/itinerary/SortableFlightLegCards.tsx` | Fix flight card layout overlap on mobile |
| `src/components/itinerary/VoyanceInsight.tsx` | Truncate insight text on mobile with expand |
| `src/components/itinerary/ItineraryValueHeader.tsx` | Minor padding reduction on mobile |

### Priority
1. Sticky tab bar + compact day headers (biggest mobile UX wins)
2. Day action overflow menu (reduces clutter)
3. Flight date box fix (visible bug)
4. VoyanceInsight truncation + spacing polish

