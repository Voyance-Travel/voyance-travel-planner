

# Fix Transit Row Alignment on Desktop

## Problem
Transit indicator rows (`TransitGapIndicator` and `TransitModePicker`) are flush-left on desktop while activity cards have a time column (96px) + thumbnail column (96px) = 192px left offset. This makes the transit rows visually misaligned — they should start at the same left edge as the activity card content.

## Solution
Add `sm:pl-[12rem]` (192px = 2 × 96px) left padding to both transit components on desktop so they align with the content column of activity cards.

### Files to modify

**1. `src/components/itinerary/TransitModePicker.tsx`** (~line 316)
- Change the outer row div from `px-3 sm:px-4` to `px-3 sm:pl-[12.5rem] sm:pr-4` so the transit row content starts after the time+thumbnail columns on desktop.

**2. `src/components/itinerary/TransitGapIndicator.tsx`** (~line 394)
- Same change: update the tappable transit row from `px-3 sm:px-4` to `px-3 sm:pl-[12.5rem] sm:pr-4`.

**3. `src/components/itinerary/EditorialItinerary.tsx`** (~line 9941)
- Also align the "Add activity" button row between activities, which currently uses `flex justify-center` without accounting for the time+thumbnail offset.

The 12.5rem value accounts for 2 × `w-24` (6rem each = 12rem) plus the 0.5rem of internal padding/border, matching the content column start.

