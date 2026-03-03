

# Make Trip Date Editing More Discoverable

## Problem
The trip date editor already exists (`TripDateEditor` component) with full extend/shorten/shift support, but users can't find it because:

1. **Too subtle trigger**: The dates display as plain text with a tiny pencil icon that only appears on hover -- users don't realize it's clickable
2. **Hidden on active trips**: The entire date/status row is wrapped in `!isLiveTrip`, so once a trip is active, users can't adjust dates at all

## Changes

### File: `src/pages/TripDetail.tsx`

**1. Move TripDateEditor outside the `!isLiveTrip` gate**

Currently the date editor is inside a block that only renders when `!isLiveTrip` (line 1171). Move the `TripDateEditor` so it renders for ALL trip statuses -- above the live/generator/itinerary conditional block. This ensures users can always adjust their dates regardless of trip status.

**2. Make the trigger visually obvious**

Update the `TripDateEditor` trigger styling to look like an interactive element rather than plain text -- adding a light background, border, and visible edit icon (not just on hover).

### File: `src/components/trip/TripDateEditor.tsx`

**3. Restyle the trigger button**

Change the trigger from a plain text link to a compact, tappable chip/button style:
- Add a subtle background (`bg-secondary/50`) and rounded corners
- Show the pencil/edit icon at all times (not just on hover)
- Add padding so the tap target is comfortable on mobile
- Keep it compact so it doesn't dominate the header

The before/after:
```text
Before:  Mar 15 - Mar 22, 2026  (pencil appears on hover only)
After:   [calendar icon] Mar 15 - Mar 22, 2026 [pencil icon]  (always visible, chip style)
```

## Result
- Users see a clearly interactive date chip on every trip
- Clicking it opens the existing calendar popover with extend/shorten/shift flows
- Works on active, draft, booked, and completed trips
- No new components needed -- just restyling and moving existing code
