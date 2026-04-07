

## Fix: Transport/Transit Card Alignment

### Problem
The transport-related UI elements (transit gap indicators, transport mode rows, and inter-city transport cards) are not properly centered/aligned within the day card. They "hang off" visually compared to the activity cards above and below them.

### Root Cause
Three different transport-related elements render at the same level as activity cards but with inconsistent padding and no alignment to the activity card's column structure (time column + thumbnail + content):

1. **TransitModePicker** (e.g., "Travel to Ob-La-Di 47 min") — uses `px-4 py-2`, not aligned to the activity card's time+thumbnail+content columns
2. **TransitGapIndicator** (e.g., "Walk to CDG → Home 5 min") — similar flat layout with its own padding
3. **InterCityTransportCard** (e.g., "CDG → Home") — has `mx-2 sm:mx-0 my-1`, sitting flush against the container edge on desktop

### Fix

1. **`src/components/itinerary/EditorialItinerary.tsx`**
   - Adjust the InterCityTransportCard wrapper to use consistent horizontal padding (`mx-0 sm:mx-4`) so it aligns with activity content area
   - On mobile, wrap transport rows inside the same timeline card container used by regular activities so they share the same left margin/indent

2. **`src/components/itinerary/TransitModePicker.tsx`**
   - Add left padding on desktop to align with the content column of activity cards (offset by the combined width of time column 96px + thumbnail column 96px = ~192px left margin, or use `sm:pl-[12rem]` to align with activity content)
   - Alternatively, keep the full-width row but indent it with a `sm:ml-[12rem]` so it visually aligns with activity titles

3. **`src/components/itinerary/TransitGapIndicator.tsx`**
   - Apply the same desktop alignment adjustment so gap indicators sit under the activity content column rather than spanning from the left edge

### Approach
The simplest fix is to add a consistent `sm:px-6` or `sm:pl-[12.5rem]` to the transport row containers on desktop, matching the start position of the activity content column (after time + thumbnail). This keeps them visually anchored to the same content flow without restructuring the component hierarchy.

### Files Changed
1. `src/components/itinerary/EditorialItinerary.tsx` — adjust InterCityTransportCard className and transport row wrappers
2. `src/components/itinerary/TransitModePicker.tsx` — align the collapsed transit row with activity content columns
3. `src/components/itinerary/TransitGapIndicator.tsx` — same alignment adjustment

