

## Problem

Transport activities (e.g. "Private car to MoMO") are rendered as compact inline rows that have two issues:

1. **Mobile: action button is invisible.** The `...` menu uses `opacity-0 group-hover/activity:opacity-100`, but the parent `div` doesn't have the `group/activity` class, AND hover doesn't work on touch devices. Result: the remove button literally cannot be reached on mobile.

2. **Desktop: only Remove in menu, no Edit.** Even when you can hover to reveal the `...` button on desktop, the dropdown only contains "Remove" — no "Edit Details", no "Move Up/Down", no "Move to Day".

3. **Travel Summary cards** (synthetic inter-city transport) have zero action buttons at all — no way to remove or edit them.

## Plan

### Fix 1: Make transport row actions accessible on mobile and add full action set

**File:** `src/components/itinerary/EditorialItinerary.tsx` (lines 8281-8336)

- Add `group/activity` class to the transport row wrapper so hover detection works on desktop
- Make the `...` button always visible on mobile (`sm:opacity-0 sm:group-hover/activity:opacity-100` instead of `opacity-0 group-hover/activity:opacity-100`)
- Add Edit and Move options to the dropdown menu (matching what regular activities get): Edit Details, Move Up, Move Down, Move to Day, Remove

### Fix 2: Add action menu to Travel Summary cards

**File:** `src/components/itinerary/EditorialItinerary.tsx` (lines 7717-7763)

- Add a `...` dropdown in the top-right of the travel summary card with Remove action
- This lets users delete synthetic inter-city transport cards they don't want

### Files Modified

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Fix transport row action visibility on mobile, add full action menu (edit/move/remove), add remove action to travel summary cards |

