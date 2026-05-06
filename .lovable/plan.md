## Plan: eliminate generated timing overlaps and make Refresh Day apply fixes reliably

### Goal
Generated itineraries should not leave overlapping time blocks after the backend repair pipeline, and the Trip Health quick-fix path should actually resolve/persist timing conflicts instead of only reporting them.

### What I’ll change
1. **Backend generation safety net**
   - Strengthen the final sequential timing enforcement in `generate-itinerary/pipeline/repair-day.ts`.
   - Add a real buffer-aware cascade so overlaps are pushed forward with the same minimum gap the UI health checker expects.
   - Keep locked/manual/pinned activities as anchors; do not mutate them.
   - Drop or leave flagged only when a day would overflow past the late-night cap.

2. **Refresh Day function fixes**
   - Update `refresh-day` so proposed time shifts are cascaded across the rest of the day, not calculated as isolated one-off patches.
   - Ensure overlap fixes include both `startTime` and `endTime`, derive missing end times safely from duration, and avoid returning patches that create a new downstream conflict.
   - Return a clear unresolved issue when the day is too packed rather than pretending a partial fix works.

3. **Trip Health quick-fix behavior**
   - Keep **Fix timing** as the applying action and **Re-check** as analysis-only.
   - After deterministic Fix timing succeeds, re-run the refresh validation for that day so the Trip Health panel shows “Re-checked · no issues” when clean.
   - Ensure applied timing changes mark the itinerary as changed and are persisted through the existing save path.

4. **UI action clarity**
   - Keep button labels aligned with behavior: “Fix timing” applies deterministic spacing; “Re-check” only analyzes.
   - If auto-spacing cannot resolve because the day is overpacked or blocked by locked anchors, open the Refresh Day diff with actionable proposed changes or an explicit unresolved message.

5. **Regression coverage**
   - Extend the existing `fixDayTiming` tests for cascading overlaps, locked anchors, missing `endTime` + duration, and day-overflow fallback.
   - Add/adjust edge-function unit coverage where feasible for `refresh-day` cascade output shape.

### Technical notes
- Primary files involved:
  - `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
  - `supabase/functions/refresh-day/index.ts`
  - `src/utils/itinerary/fixDayTiming.ts`
  - `src/components/itinerary/EditorialItinerary.tsx`
  - `src/components/trip/TripHealthPanel.tsx`
- No database schema changes are needed.
- No budget or cost logic will be changed.