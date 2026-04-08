

# Restyle InterCityTransportCard to Match Activity Card Layout

## Problem
The InterCityTransportCard (used for flights, trains, "Heading Home" cards) renders as a standalone bordered box that looks disconnected from the activity card layout. The user wants it to match the same visual structure as regular activity cards.

## Current Layout
Activity cards use a 3-column desktop layout: **Time column (w-24)** | **Thumbnail (w-24)** | **Content (flex-1)**, with a mobile card wrapper. The InterCityTransportCard ignores this entirely and renders as a flat padded card with `sm:pl-[12rem]` left offset.

## Plan

### 1. Refactor InterCityTransportCard to use the activity card layout pattern

**File: `src/components/itinerary/InterCityTransportCard.tsx`**

- Add a `startTime` prop so the time column can display departure time
- Restructure the desktop layout to match activity cards:
  - **Time column** (w-24, left side): Show departure time with the same styling as activity rows
  - **Icon/thumbnail column** (w-24): Show the transport mode icon (train, plane, etc.) centered in the same 24x24 thumbnail slot, with a subtle muted background
  - **Content column** (flex-1): Keep the existing header text ("HEADING HOME · TRAIN"), title ("CDG → Home"), route visualization, carrier/time details, and expandable section
- On mobile, use the same card wrapper pattern (rounded-xl, border, shadow-sm) with the transport icon + title as a compact tappable row
- Keep the `variant='final'` accent styling (primary border-left) but apply it within the new structure

### 2. Update the render site in EditorialItinerary

**File: `src/components/itinerary/EditorialItinerary.tsx`** (around line 9757-9775)

- Remove the current standalone render with `className="mx-3 sm:mx-4 sm:pl-[12rem] my-1"`
- Instead, wrap the InterCityTransportCard in the same mobile/desktop dual-render pattern used by ActivityRow:
  - Mobile: timeline dot + card wrapper (`sm:hidden`, `pl-7 pr-2`)
  - Desktop: flat layout (`hidden sm:block`)
- Pass the activity's `startTime` or `depTime` from travelMeta to the time column
- The card should sit flush in the activity list, visually indistinguishable in structure from a regular activity row

### Visual Result
```text
Desktop (before):
                              ┌──────────────────────────┐
                              │ 🚂 HEADING HOME · TRAIN  │
                              │    CDG → Home             │
                              │ ⏱ 12:43 PM               │
                              └──────────────────────────┘

Desktop (after):
┌────────┬────────┬──────────────────────────────────────┐
│ 12:43  │  🚂   │ HEADING HOME · TRAIN                  │
│ PM     │       │ CDG → Home                             │
│        │       │ Duration: 193 min                      │
└────────┴────────┴──────────────────────────────────────┘
```

### What's NOT changed
- No backend/edge function changes
- No changes to how InterCityTransportCard data is computed or passed
- The `variant`, `travelMeta`, and expandable details logic all remain intact
- Mobile timeline dot and card styling follows existing patterns exactly

