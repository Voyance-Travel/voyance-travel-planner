

## Already Implemented

The TransitModePicker feature described in your request is **already fully implemented**:

1. **`src/components/itinerary/TransitModePicker.tsx`** exists (444 lines) with:
   - Tappable row that expands/collapses inline transport options
   - Calls `airport-transfers` edge function to fetch alternatives
   - AI recommendation display
   - "Select" button to switch modes (updates title, duration, cost via `onEdit`)
   - Separate three-dot context menu with `e.stopPropagation()` — Edit Details, Move, Remove

2. **`src/components/itinerary/EditorialItinerary.tsx`** (line 8519-8562) already renders `<TransitModePicker>` for all transport activities via the `if (isTransport)` early return.

3. **The critical bug prevention** is already handled: the row `onClick` calls `handleExpand` (not `onEdit`), and the dropdown trigger uses `e.stopPropagation()`.

No code changes are needed. If you're experiencing the Edit Activity dialog opening when tapping a transit row, that would be a runtime bug worth investigating — let me know and I can debug it.

