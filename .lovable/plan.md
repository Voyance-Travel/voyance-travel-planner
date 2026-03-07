
Root cause (why this kept failing):
1) We fixed some flight-form components, but not all remaining mobile two-column flight grids (at least `FlightDetailsModal.tsx` still has `grid-cols-2` pairs).
2) The overlap in your screenshot is a different issue: mobile trip header is rendering both compact status text and a date-editor pill in the same row, so it gets crowded and visually overlaps/wraps.
3) Current mobile date-editor behavior is still too “pill-like” (too wide), instead of being a tiny inline edit control.

Implementation plan (no feature removal, only layout simplification):

1) Hard-fix the header overlap at the source
- File: `src/pages/TripDetail.tsx`
- Mobile status row will become: `Draft · Mar 19–23 · 5d` + a tiny inline edit icon.
- Remove duplicate mobile date display pressure by keeping date text only once in the status line.
- Add robust mobile row constraints: `min-w-0`, compact gaps, `whitespace-nowrap` where needed, and prevent wrapping collisions.

2) Make TripDateEditor truly compact on mobile
- File: `src/components/trip/TripDateEditor.tsx`
- Add a dedicated compact/icon-only trigger mode (not breakpoint-dependent text hiding).
- Mobile trigger style: small circular icon button (`h-7 w-7`, minimal padding, no wide pill text).
- Keep full date pill trigger for desktop exactly as-is.
- Keep all date editing functionality identical (popover, validations, dialogs).

3) Finish the incomplete flight mobile grid fixes
- Files:
  - `src/components/itinerary/FlightDetailsModal.tsx`
  - `src/components/itinerary/InterCityTransportEditor.tsx` (where flight/inter-city rows still use fixed 2-col pairs)
- Replace remaining `grid grid-cols-2 gap-3` rows with `grid grid-cols-1 sm:grid-cols-2 gap-3` for all field-pair rows.
- Keep desktop unchanged; mobile stacks fields cleanly.

4) Mobile sizing polish for the specific “too large controls” complaint
- In the affected mobile form rows, normalize to compact control scale (`h-8 text-xs` where currently oversized) for date/time pairs and adjacent controls.

5) Verification checklist before closing
- Test on narrow mobile widths (375 and 390):
  - Generation screen header: no overlap between status line and date-edit control.
  - Trip detail header: single clean date line + tiny edit icon.
  - Flight edit/import/detail forms: no overlapping fields; stacked correctly on mobile.
- Recheck desktop to confirm no regressions in existing layout/functionality.

Files to touch in the implementation pass:
- `src/pages/TripDetail.tsx`
- `src/components/trip/TripDateEditor.tsx`
- `src/components/itinerary/FlightDetailsModal.tsx`
- `src/components/itinerary/InterCityTransportEditor.tsx`
