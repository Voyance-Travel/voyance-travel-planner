
# Fix: Attach Action Toolbar Directly to Itinerary Day Content

## Problem
The Add/Discover/Import/Refresh toolbar is rendering at the very bottom of the itinerary tab container -- after unlock banners, credit nudges, and other elements. This makes it appear visually disconnected from the day's activity cards, floating below unrelated content.

## Solution
Move the `DayActionToolbar` from its current position (line ~3881, after all banners) to directly after the `DayCard` component (line ~3849), so it sits immediately below the day's activities as part of the day content block.

## Changes

### File: `src/components/itinerary/EditorialItinerary.tsx`

1. **Remove** the `DayActionToolbar` block from its current location (lines 3881-3896), which is after the unlock banner and credit nudge sections.

2. **Insert** the same `DayActionToolbar` block immediately after the `DayCard` / locked day card rendering (right after line 3849, inside the day content `div`), so the toolbar appears directly beneath the last activity card of the selected day.

The toolbar will only render when:
- A valid day is selected (`days[selectedDayIndex]` exists)
- The day is not in locked/preview mode
- `isEditable` is true

This is a single-file, ~15-line move with no logic changes -- just repositioning the component in the JSX tree so it renders in the correct visual location.
